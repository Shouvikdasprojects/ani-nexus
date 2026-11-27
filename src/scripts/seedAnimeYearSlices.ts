import mongoose from 'mongoose';
import {
  connectDatabase,
  getAllFranchiseModels,
  getVault1BConnection,
  getVaultLogicalMB,
} from '../config/database.js';
import { findOneAcrossVaults, countAcrossVaults } from '../utils/vaultQuery.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';

const GRAPHQL_URL = 'https://graphql.anilist.co';
const SAFE_VAULT1_LIMIT_MB = 440;
const SAFE_VAULT1B_LIMIT_MB = 450;

const ANIME_PAGE_QUERY = `
  query ($page: Int, $perPage: Int, $greater: FuzzyDateInt, $lesser: FuzzyDateInt) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, startDate_greater: $greater, startDate_lesser: $lesser, sort: [POPULARITY_DESC]) {
        id
        idMal
        title { romaji english native userPreferred }
        synonyms
        format
        countryOfOrigin
        status
        source
        description(asHtml: false)
        startDate { year month day }
        endDate { year month day }
        season
        seasonYear
        episodes
        duration
        isAdult
        genres
        tags { name rank }
        averageScore
        meanScore
        popularity
        favourites
        trailer { id site thumbnail }
        coverImage { extraLarge large }
        bannerImage
        studios(isMain: false) {
          edges {
            isMain
            node { id name isAnimationStudio }
          }
        }
        stats {
          scoreDistribution { score amount }
          statusDistribution { status amount }
        }
        recommendations(perPage: 8, sort: [RATING_DESC]) {
          nodes {
            rating
            mediaRecommendation {
              id
              idMal
              type
              title { romaji english userPreferred }
              format
              coverImage { large }
              averageScore
            }
          }
        }
        externalLinks { site type url }
        staff(perPage: 12) {
          edges {
            role
            node { id name { full native } image { large } }
          }
        }
        characters(perPage: 15, sort: [ROLE, RELEVANCE]) {
          edges {
            role
            node { id name { full native } image { large } }
          }
        }
        relations {
          edges {
            relationType
            node {
              id
              idMal
              type
              format
              status
              title { romaji english userPreferred }
              coverImage { large }
            }
          }
        }
      }
    }
  }
`;

async function fetchAnimePage(year: number, page: number, perPage = 50): Promise<any[]> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: ANIME_PAGE_QUERY,
          variables: {
            page,
            perPage,
            greater: year * 10000,
            lesser: year * 10000 + 1231,
          },
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 429) {
        const wait = parseInt(res.headers.get('retry-after') || '60', 10);
        console.warn(`⏳ [AniList Rate Limiter]: 429 cooldown. Waiting ${wait + 2}s...`);
        await new Promise((r) => setTimeout(r, (wait + 2) * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: any = await res.json();
      return json?.data?.Page?.media || [];
    } catch (err: any) {
      if (attempt === 5) throw err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  return [];
}

async function seedAnimeYearSlices() {
  console.log('🚀 Starting AniNexus Year-Slice Anime Seeder (Vault 1B)...');
  await connectDatabase();

  const franchiseModels = getAllFranchiseModels();
  const vault1bConn = getVault1BConnection();

  let startYear = 2026;
  let endYear = 1960;
  for (const arg of process.argv) {
    if (arg.startsWith('--startYear=')) startYear = parseInt(arg.split('=')[1], 10) || 2026;
    if (arg.startsWith('--endYear=')) endYear = parseInt(arg.split('=')[1], 10) || 1960;
  }

  const initialCount = await countAcrossVaults(franchiseModels);
  console.log(`📚 Initial Anime Franchises (Vault 1 + 1B): ${initialCount}`);
  console.log(`🎯 Target Range: Years ${startYear} down to ${endYear}`);

  let totalProcessed = 0;
  let newlyIngested = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (let year = startYear; year >= endYear; year--) {
    console.log(`\n📅 >>> Scanning Anime Year Slice: ${year} <<<`);
    let page = 1;
    let yearHasMore = true;

    while (yearHasMore) {
      const pageItems = await fetchAnimePage(year, page, 50);
      if (!pageItems || pageItems.length === 0) {
        console.log(`🏁 Completed Anime Year ${year} at page ${page - 1}.`);
        yearHasMore = false;
        break;
      }

      const CONCURRENCY = 3;
      for (let idx = 0; idx < pageItems.length; idx += CONCURRENCY) {
        if (!yearHasMore) break;
        const chunk = pageItems.slice(idx, idx + CONCURRENCY);

        await Promise.all(
          chunk.map(async (item) => {
            totalProcessed++;
            const title = item.title?.english || item.title?.romaji || `ID:${item.id}`;

            const existing = await findOneAcrossVaults(
              franchiseModels,
              {
                $or: [
                  { 'timeline.ids.aniId': item.id },
                  ...(item.idMal ? [{ 'timeline.ids.malId': item.idMal }] : []),
                ],
              },
              { _id: 1, slug: 1 }
            ).catch(() => null);

            if (existing) {
              skippedExisting++;
              console.log(`[${year} | P${page}] ⏩ [Already in DB] '${title}'`);
              return;
            }

            try {
              const doc = await franchiseBuilder.buildFromAniListMedia(item, item.idMal);
              if (doc) {
                newlyIngested++;
                console.log(`[${year} | P${page}] ✅ Ingested '${doc.titles?.primary || title}'`);
              } else {
                failed++;
              }
            } catch (err: any) {
              failed++;
              console.warn(`⚠️ Failed '${title}': ${err.message}`);
            }
          })
        );

        if (totalProcessed % 50 < CONCURRENCY) {
          try {
            const v1MB = await getVaultLogicalMB(mongoose.connection);
            const v1bMB = await getVaultLogicalMB(vault1bConn);
            const totalFranchises = await countAcrossVaults(franchiseModels);
            console.log(
              `\n📊 --- [Anime ${year} Milestone] Processed: ${totalProcessed} | New: ${newlyIngested} | Total Franchises: ${totalFranchises} | Vault 1: ${v1MB.toFixed(2)}/${SAFE_VAULT1_LIMIT_MB}MB | Vault 1B: ${v1bMB.toFixed(2)}/${SAFE_VAULT1B_LIMIT_MB}MB ---\n`
            );

            if (v1MB >= SAFE_VAULT1_LIMIT_MB && (!vault1bConn || v1bMB >= SAFE_VAULT1B_LIMIT_MB)) {
              console.warn(
                `🛑 [Safety Auto-Pause]: Vault 1 (${v1MB.toFixed(2)}MB) & Vault 1B (${v1bMB.toFixed(2)}MB) reached safe capacity limit. Pausing cleanly at Year ${year}, Page ${page}!`
              );
              await mongoose.disconnect();
              process.exit(2);
            }
          } catch {}
        }
      }

      page++;
      await new Promise((r) => setTimeout(r, 900));
    }
  }

  console.log(`\n🎉 Anime Year-Slice Seeding Complete! Processed: ${totalProcessed} | New: ${newlyIngested} | Skipped: ${skippedExisting} | Failed: ${failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

seedAnimeYearSlices().catch(async (err) => {
  console.error('Fatal Anime Year-Slice Seeder Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
