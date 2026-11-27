import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  connectDatabase,
  getCharacterModel,
  getVault1BCharacterModel,
  getVault1BConnection,
  getVaultLogicalMB,
} from '../config/database.js';
import { characterStaffService } from '../services/characterStaffService.js';

const GRAPHQL_URL = 'https://graphql.anilist.co';
const CHECKPOINT_FILE = path.resolve(process.cwd(), 'data', 'char_va_backfill_checkpoint.json');
const SAFE_VAULT1_LIMIT_MB = 440; // Stay safely under Atlas M0 512MB limit during parallel seeding
const SAFE_VAULT1B_LIMIT_MB = 450; // Auto-pause before Vault 1B hits 512MB Atlas limit

const args = process.argv.slice(2).reduce((acc: Record<string, string>, curr) => {
  if (curr.startsWith('--')) {
    const [key, val] = curr.replace(/^--/, '').split('=');
    acc[key] = val || 'true';
  }
  return acc;
}, {});
const delayMs = parseInt(args.delay || '2200', 10);

const BACKFILL_QUERY = `
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
            voiceActors {
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

async function fetchBatch(ids: number[]): Promise<any[]> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: BACKFILL_QUERY, variables: { id_in: ids, perPage: ids.length } }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        const wait = parseInt(res.headers.get('retry-after') || '60', 10);
        console.warn(`⏳ Rate limit 429, waiting ${wait + 2}s...`);
        await new Promise((r) => setTimeout(r, (wait + 2) * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      return json?.data?.Page?.characters || [];
    } catch (err: any) {
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return [];
}

async function withDbRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 8): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      const waitSec = Math.min(attempt * 5, 30);
      console.warn(`⏳ [DB Network Recovery - ${label}]: ${err.message}. Retrying in ${waitSec}s (${attempt}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    }
  }
  throw new Error(`Unreachable retry failure in ${label}`);
}

async function runBackfill() {
  await connectDatabase();
  const Primary = getCharacterModel();
  const Vault1B = getVault1BCharacterModel();
  const vault1bConn = getVault1BConnection();

  let startAfterId = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      startAfterId = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')).lastCharacterId || 0;
    } catch {}
  }

  console.log(`🚀 Backfilling Character VoiceActors + MangaAppearances (startAfter=${startAfterId}, delay=${delayMs}ms)`);
  let processed = 0;
  let iteration = 0;
  let vault1Full = (await getVaultLogicalMB(mongoose.connection)) >= SAFE_VAULT1_LIMIT_MB;

  const models = Vault1B ? [Primary, Vault1B] : [Primary];
  for (const Model of models) {
    let cursorId = Model === Primary ? startAfterId : 0;
    while (true) {
      iteration++;
      if (iteration % 5 === 0) {
        const v1Mb = await withDbRetry(() => getVaultLogicalMB(mongoose.connection), 'v1-stats');
        const v1bMb = await withDbRetry(() => getVaultLogicalMB(vault1bConn), 'v1b-stats');
        vault1Full = v1Mb >= SAFE_VAULT1_LIMIT_MB;
        console.log(`📊 [Backfill Storage] Vault 1: ${v1Mb.toFixed(2)}/${SAFE_VAULT1_LIMIT_MB}MB | Vault 1B: ${v1bMb.toFixed(2)}/${SAFE_VAULT1B_LIMIT_MB}MB | Spillover: ${vault1Full}`);

        if (vault1Full && (!Vault1B || v1bMb >= SAFE_VAULT1B_LIMIT_MB)) {
          console.warn(`🛑 [Safety Auto-Pause]: Vault 1 (${v1Mb.toFixed(2)}MB) & Vault 1B (${v1bMb.toFixed(2)}MB) reached safe capacity limit. Pausing cleanly so you can add a new DB!`);
          process.exit(2);
        }
      }

      const docs = await withDbRetry(
        () =>
          Model.find(
            {
              characterId: { $gt: cursorId },
              $or: [{ 'voiceActors.0': { $exists: false } }, { 'mangaAppearances.0': { $exists: false } }],
            },
            { characterId: 1 }
          )
            .sort({ characterId: 1 })
            .limit(50)
            .lean(),
        'find-batch'
      );

      if (docs.length === 0) break;
      const ids = docs.map((d: any) => d.characterId);
      cursorId = ids[ids.length - 1];

      const rawChars = await fetchBatch(ids);
      const spillToVault1B = Model === Primary && vault1Full && Boolean(Vault1B);
      const WriteModel = spillToVault1B ? Vault1B! : Model;

      const ops = rawChars
        .map((raw) => {
          const prepared = characterStaffService.prepareCharacterDoc(raw);
          if (!prepared) return null;

          if (spillToVault1B) {
            return {
              updateOne: {
                filter: { characterId: prepared.characterId },
                update: { $set: prepared },
                upsert: true,
              },
            };
          }

          return {
            updateOne: {
              filter: { characterId: prepared.characterId },
              update: {
                $set: {
                  primaryVoiceActor: prepared.primaryVoiceActor,
                  voiceActors: prepared.voiceActors,
                  animeAppearances: prepared.animeAppearances,
                  mangaAppearances: prepared.mangaAppearances,
                  mediaCount: prepared.mediaCount,
                  lastUpdated: new Date(),
                },
              },
            },
          };
        })
        .filter(Boolean);

      if (ops.length > 0) {
        await withDbRetry(() => WriteModel.bulkWrite(ops as any, { ordered: false }), 'bulkWrite');
        if (spillToVault1B) {
          const movedIds = rawChars.map((r) => r.id).filter(Boolean);
          if (movedIds.length > 0) {
            await Primary.deleteMany({ characterId: { $in: movedIds } }).catch(() => {});
          }
        }
      }

      processed += ids.length;
      if (Model === Primary) {
        fs.mkdirSync(path.dirname(CHECKPOINT_FILE), { recursive: true });
        fs.writeFileSync(
          CHECKPOINT_FILE,
          JSON.stringify({ lastCharacterId: cursorId, processed, updatedAt: new Date().toISOString() }, null, 2)
        );
      }
      console.log(`✅ Backfilled ${ops.length}/${ids.length} chars -> ${spillToVault1B ? 'Vault 1B' : Model === Primary ? 'Vault 1' : 'Vault 1B'} (last ID: ${cursorId} | total: ${processed})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(`🏁 Character VA + Mangaography backfill finished. Processed ${processed} records.`);
  process.exit(0);
}

runBackfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
