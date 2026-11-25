import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import fs from 'fs';
import path from 'path';
import { connectDatabase, getCharacterModel, getStaffModel, isPrimaryVaultFull } from '../config/database.js';
import { characterStaffService } from '../services/characterStaffService.js';
import mongoose from 'mongoose';

const GRAPHQL_URL = 'https://graphql.anilist.co';
const CHECKPOINT_DIR = path.resolve(process.cwd(), 'data');
const CHECKPOINT_FILE = path.join(CHECKPOINT_DIR, 'character_staff_checkpoint.json');

// Parse CLI Flags
const args = process.argv.slice(2).reduce((acc: Record<string, string>, curr) => {
  if (curr.startsWith('--')) {
    const [key, val] = curr.replace(/^--/, '').split('=');
    acc[key] = val || 'true';
  }
  return acc;
}, {});

const mode = (args.mode || 'both').toLowerCase(); // 'both' | 'characters' | 'staff'
const batchSize = parseInt(args.batchSize || '50', 10);
const delayMs = parseInt(args.delay || '1200', 10);
const maxCharId = parseInt(args.maxCharId || '415000', 10);
const maxStaffId = parseInt(args.maxStaffId || '415000', 10);

interface Checkpoint {
  lastCharId: number;
  lastStaffId: number;
  totalCharsSaved: number;
  totalStaffSaved: number;
  lastUpdated: string;
}

function loadCheckpoint(): Checkpoint {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const content = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err: any) {
    console.warn('⚠️ Could not load checkpoint, starting fresh:', err.message);
  }
  return {
    lastCharId: 1,
    lastStaffId: 95001,
    totalCharsSaved: 0,
    totalStaffSaved: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveCheckpoint(cp: Checkpoint) {
  try {
    if (!fs.existsSync(CHECKPOINT_DIR)) {
      fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    }
    cp.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf-8');
  } catch (err: any) {
    console.warn('⚠️ Failed to save checkpoint:', err.message);
  }
}

async function fetchGraphQL(query: string, variables: any = {}): Promise<any> {
  let attempt = 0;
  while (attempt < 5) {
    attempt++;
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'AniNexus-Turbo-CharacterStaff-Seeder/2.0',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10);
        console.warn(`⏳ [Rate Limit 429]: AniList requested wait of ${retryAfter}s. Sleeping...`);
        await new Promise((r) => setTimeout(r, (retryAfter + 2) * 1000));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json: any = await res.json();
      if (json.errors && json.errors.length) {
        throw new Error(`GraphQL: ${json.errors[0].message}`);
      }

      return json.data;
    } catch (err: any) {
      if (attempt >= 5) throw err;
      console.warn(`⚠️ Request failed (attempt ${attempt}/5): ${err.message}. Retrying in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

const CHARACTERS_CHUNK_QUERY = `
  query ($id_in: [Int], $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      characters(id_in: $id_in) {
        id
        name { full native alternative alternativeSpoiler }
        image { large }
        description
        gender
        dateOfBirth { year month day }
        age
        bloodType
        favourites
        media(sort: [POPULARITY_DESC], perPage: 8) {
          edges {
            characterRole
            node {
              id
              type
              title { romaji english userPreferred }
              startDate { year }
              format
              coverImage { large }
            }
            voiceActors(language: JAPANESE) {
              id
              name { full native }
              image { large }
              languageV2
            }
          }
        }
      }
    }
  }
`;

const STAFF_CHUNK_QUERY = `
  query ($id_in: [Int], $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      staff(id_in: $id_in) {
        id
        name { full native alternative }
        image { large }
        description
        primaryOccupations
        gender
        dateOfBirth { year month day }
        dateOfDeath { year month day }
        age
        favourites
        characterMedia(sort: [POPULARITY_DESC], perPage: 8) {
          edges {
            characterRole
            node {
              id
              title { romaji english userPreferred }
              startDate { year }
              format
            }
            characters {
              id
              name { full }
              image { large }
            }
          }
        }
        staffMedia(sort: [POPULARITY_DESC], perPage: 8) {
          edges {
            staffRole
            node {
              id
              title { romaji english userPreferred }
              startDate { year }
              format
            }
          }
        }
      }
    }
  }
`;

async function runTurboSeeder() {
  console.log('===============================================================');
  console.log('⚡ AniNexus Turbo Deep Seeder: Characters & Staff Ingestion');
  console.log('===============================================================\n');

  await connectDatabase();

  const CharModel = getCharacterModel();
  const StaffModel = getStaffModel();

  const initialChars = await CharModel.countDocuments();
  const initialStaff = await StaffModel.countDocuments();

  const checkpoint = loadCheckpoint();
  let currentCharId = args.startCharId ? parseInt(args.startCharId, 10) : checkpoint.lastCharId;
  let currentStaffId = args.startStaffId ? parseInt(args.startStaffId, 10) : checkpoint.lastStaffId;

  console.log(`📊 Initial DB Counts: ${initialChars} Characters | ${initialStaff} Staff Profiles`);
  console.log(`📌 Starting Position -> Character ID: ${currentCharId} | Staff ID: ${currentStaffId}`);
  console.log(`⚙️  Configuration: Mode=${mode} | BatchSize=${batchSize} | Delay=${delayMs}ms\n`);

  let iteration = 0;
  let totalCharsThisRun = 0;
  let totalStaffThisRun = 0;
  const startTime = Date.now();

  const shouldRunChars = mode === 'both' || mode === 'characters';
  const shouldRunStaff = mode === 'both' || mode === 'staff';

  while (
    (shouldRunChars && currentCharId <= maxCharId) ||
    (shouldRunStaff && currentStaffId <= maxStaffId)
  ) {
    iteration++;

    // 1. Process Character Chunk
    if (shouldRunChars && currentCharId <= maxCharId) {
      const charIds = Array.from({ length: batchSize }, (_, i) => currentCharId + i);
      const t0 = Date.now();

      try {
        const data = await fetchGraphQL(CHARACTERS_CHUNK_QUERY, {
          id_in: charIds,
          perPage: batchSize,
        });

        const rawList = data?.Page?.characters || [];
        if (rawList.length > 0) {
          const savedCount = await characterStaffService.saveCharactersBulk(rawList);
          totalCharsThisRun += savedCount;
          checkpoint.totalCharsSaved += savedCount;
          const elapsed = (Date.now() - t0) / 1000;
          const speed = (savedCount / Math.max(elapsed, 0.001)).toFixed(1);
          console.log(
            `[CHAR ⚡ ${currentCharId}..${currentCharId + batchSize - 1}] Saved ${savedCount}/${rawList.length} chars in ${elapsed.toFixed(2)}s (${speed}/s) | Total This Run: ${totalCharsThisRun}`
          );
        } else {
          process.stdout.write(`[CHAR ⏩ ${currentCharId}..${currentCharId + batchSize - 1}] No items (sparse range)\n`);
        }
      } catch (err: any) {
        console.error(`❌ [CHAR Error at ${currentCharId}]:`, err.message);
      }

      currentCharId += batchSize;
      checkpoint.lastCharId = currentCharId;
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // 2. Process Staff Chunk
    if (shouldRunStaff && currentStaffId <= maxStaffId) {
      const staffIds = Array.from({ length: batchSize }, (_, i) => currentStaffId + i);
      const t0 = Date.now();

      try {
        const data = await fetchGraphQL(STAFF_CHUNK_QUERY, {
          id_in: staffIds,
          perPage: batchSize,
        });

        const rawList = data?.Page?.staff || [];
        if (rawList.length > 0) {
          const savedCount = await characterStaffService.saveStaffBulk(rawList);
          totalStaffThisRun += savedCount;
          checkpoint.totalStaffSaved += savedCount;
          const elapsed = (Date.now() - t0) / 1000;
          const speed = (savedCount / Math.max(elapsed, 0.001)).toFixed(1);
          console.log(
            `[STAFF 🎙️ ${currentStaffId}..${currentStaffId + batchSize - 1}] Saved ${savedCount}/${rawList.length} staff in ${elapsed.toFixed(2)}s (${speed}/s) | Total This Run: ${totalStaffThisRun}`
          );
        } else {
          process.stdout.write(`[STAFF ⏩ ${currentStaffId}..${currentStaffId + batchSize - 1}] No items (sparse range)\n`);
        }
      } catch (err: any) {
        console.error(`❌ [STAFF Error at ${currentStaffId}]:`, err.message);
      }

      currentStaffId += batchSize;
      checkpoint.lastStaffId = currentStaffId;
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // Periodic Checkpoint & Storage Telemetry
    if (iteration % 10 === 0) {
      saveCheckpoint(checkpoint);
    }

    if (iteration % 30 === 0) {
      try {
        const isFull = await isPrimaryVaultFull();
        const primaryStats = await mongoose.connection.db?.stats();
        const primaryMB = ((primaryStats?.storageSize || primaryStats?.dataSize || 0) / (1024 * 1024)).toFixed(2);
        const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
        console.log(
          `\n📈 [TELEMETRY (${elapsedMin}m)]: Vault 1: ${primaryMB} MB / 480 MB (Full: ${isFull}) | Checkpoint: Char=${currentCharId}, Staff=${currentStaffId}\n`
        );
      } catch {}
    }
  }

  saveCheckpoint(checkpoint);
  console.log('\n🎉 Turbo Seeding Cycle Complete!');
  console.log(`Ingested ${totalCharsThisRun} Characters and ${totalStaffThisRun} Staff Profiles.`);
  process.exit(0);
}

runTurboSeeder().catch((err) => {
  console.error('💥 Fatal Seeder Error:', err);
  process.exit(1);
});
