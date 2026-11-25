import {
  connectDatabase,
  getAllMangaModels,
  getSecondaryConnection,
  getVault2BConnection,
  getVaultLogicalMB,
  getCapacityLimitMB,
  isVault2Full,
  isVault2BFull,
} from '../config/database.js';
import { findOneAcrossVaults, countAcrossVaults } from '../utils/vaultQuery.js';
import { anilistService } from '../services/anilistService.js';
import { mangaBuilder } from '../services/mangaBuilder.js';
import mongoose from 'mongoose';

async function seedManga() {
  console.log('🚀 Starting AniNexus Resilient Omni-Catalog Reading Media Seeder...');
  await connectDatabase();

  const mangaModels = getAllMangaModels();

  // Parse CLI args
  let limit = 100;
  let category = 'all';
  let page = 1;
  const isAll = process.argv.includes('--all') || process.argv.some((a) => a.startsWith('--limit=all'));

  for (const arg of process.argv) {
    if (arg.startsWith('--limit=') && !arg.includes('all')) {
      limit = parseInt(arg.split('=')[1], 10) || 100;
    }
    if (arg.startsWith('--category=')) {
      category = arg.split('=')[1].toLowerCase();
    }
    if (arg.startsWith('--startPage=')) {
      page = parseInt(arg.split('=')[1], 10) || 1;
    }
  }

  if (isAll) {
    limit = Infinity;
  }

  // Count current titles across Vault 2 & Vault 2B
  const currentInitialCount = await countAcrossVaults(mangaModels);
  console.log(`📚 Initial Reading Catalog Count (Vault 2 + Vault 2B): ${currentInitialCount} titles already present.`);

  // Auto-detect optimal start page if user didn't specify startPage and starting Pass 1
  if (page === 1 && currentInitialCount > 50 && category === 'all') {
    // Each page holds 50 items; jump close to the frontier (leaving 1 page overlap for safety)
    const suggestedPage = Math.max(1, Math.floor(currentInitialCount / 50) - 1);
    console.log(`⏩ Smart Resume: Detected ${currentInitialCount} existing records. Jumping to frontier page ${suggestedPage}...`);
    page = suggestedPage;
  }

  console.log(`🎯 Configuration: Target = ${isAll ? 'ALL (Omni-Catalog)' : limit} titles | Category = ${category} | Start Page = ${page}`);

  // Define crawler queues / passes
  interface CrawlerPass {
    name: string;
    sort: string[];
    filters?: { countryOfOrigin?: string; format?: string };
  }

  let passes: CrawlerPass[] = [];

  if (category === 'manhwa') {
    passes.push({ name: 'Korean Webtoons & Manhwa', sort: ['POPULARITY_DESC'], filters: { countryOfOrigin: 'KR' } });
  } else if (category === 'novels' || category === 'novel') {
    passes.push({ name: 'Light Novels & Web Novels', sort: ['POPULARITY_DESC'], filters: { format: 'NOVEL' } });
  } else if (category === 'rated') {
    passes.push({ name: 'Top Rated Reading Media', sort: ['SCORE_DESC'] });
  } else if (category === 'manhua') {
    passes.push({ name: 'Chinese Manhua', sort: ['POPULARITY_DESC'], filters: { countryOfOrigin: 'CN' } });
  } else {
    // Comprehensive Multi-Pass Omni Seeder
    passes = [
      { name: '1. Global Popular Titles (Manga, Manhwa, Novels)', sort: ['POPULARITY_DESC'] },
      { name: '2. Dedicated Korean Manhwa Archive', sort: ['POPULARITY_DESC'], filters: { countryOfOrigin: 'KR' } },
      { name: '3. Light Novels & Web Novels Vault', sort: ['POPULARITY_DESC'], filters: { format: 'NOVEL' } },
      { name: '4. Chinese Manhua Archive', sort: ['POPULARITY_DESC'], filters: { countryOfOrigin: 'CN' } },
      { name: '5. Highest Community Rated Classics', sort: ['SCORE_DESC'] },
      { name: '6. Trending & Recently Popular', sort: ['TRENDING_DESC'] },
    ];
  }

  const perPage = 50;
  let totalProcessed = 0;
  let newlyIngested = 0;
  let skippedExisting = 0;
  let failed = 0;

  console.log(`\n======================================================`);
  console.log(`📦 Commencing Continuous Reading Media Ingestion into Vault 2`);
  console.log(`======================================================\n`);

  for (let pIdx = 0; pIdx < passes.length; pIdx++) {
    const p = passes[pIdx];
    if (totalProcessed >= limit) break;
    console.log(`\n🌀 >>> Initiating Pass ${pIdx + 1}/${passes.length}: [${p.name}] <<<`);

    let currentPassPage = pIdx === 0 ? page : 1;
    let passHasMore = true;

    while (passHasMore && totalProcessed < limit) {
      console.log(`🔍 [${p.name}] Fetching Page ${currentPassPage}...`);

      let pageItems: any[] = [];
      let pageRetries = 0;
      while (pageRetries < 5) {
        try {
          pageItems = await anilistService.getTopManga(currentPassPage, perPage, p.sort, p.filters);
          break;
        } catch (fetchErr: any) {
          pageRetries++;
          console.warn(`⏳ [Network Glitch]: Failed to fetch page ${currentPassPage} (${fetchErr.message}). Retrying in 6s (${pageRetries}/5)...`);
          await new Promise((r) => setTimeout(r, 6000));
        }
      }

      if (!pageItems || pageItems.length === 0) {
        console.log(`🏁 Reached end of catalog for pass [${p.name}] at page ${currentPassPage}.`);
        passHasMore = false;
        break;
      }

      for (let i = 0; i < pageItems.length && totalProcessed < limit; i++) {
        const item = pageItems[i];
        totalProcessed++;
        const itemTitle = item.title?.english || item.title?.romaji || item.title?.userPreferred || `ID:${item.id}`;

        // 1. Resilient DB existence check across Vault 2 & Vault 2B
        let existing: any = null;
        let dbRetry = 0;
        while (dbRetry < 5) {
          try {
            existing = await findOneAcrossVaults(
              mangaModels,
              {
                $or: [
                  { 'ids.aniId': item.id },
                  ...(item.idMal ? [{ 'ids.malId': item.idMal }] : []),
                ],
              },
              { titles: 1, slug: 1, type: 1 }
            );
            break;
          } catch (netErr: any) {
            dbRetry++;
            console.warn(`⏳ [DB Network Recovery]: ${netErr.message}. Retrying query in 5s (${dbRetry}/5)...`);
            await new Promise((r) => setTimeout(r, 5000));
          }
        }

        if (existing) {
          skippedExisting++;
          console.log(`[${totalProcessed}/${isAll ? '∞' : limit}] ⏩ [Already in Vault 2/2B] '${existing.titles.primary}' [${existing.type}]`);
          continue;
        }

        // 2. Fetch & Ingest full details into Vault 2 / 2B
        const startTime = Date.now();
        let ingestSuccess = false;
        let ingestRetries = 0;

        while (!ingestSuccess && ingestRetries < 3) {
          try {
            const mangaDoc = await mangaBuilder.buildAndSaveManga({
              aniId: item.id,
              malId: item.idMal,
            });
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

            if (mangaDoc) {
              newlyIngested++;
              ingestSuccess = true;
              console.log(
                `[${totalProcessed}/${isAll ? '∞' : limit}] ✅ Ingested [${mangaDoc.type}] '${mangaDoc.titles.primary}' (${mangaDoc.chapters || '?'} ch, ${mangaDoc.adaptations.length} anime links) in ${elapsed}s`
              );
            } else {
              failed++;
              ingestSuccess = true;
              console.warn(`[${totalProcessed}/${isAll ? '∞' : limit}] ⚠️ Skipped '${itemTitle}' (no data returned)`);
            }
          } catch (err: any) {
            ingestRetries++;
            console.warn(`⏳ Ingest retry for '${itemTitle}' (${err.message}) [${ingestRetries}/3]...`);
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        // Rate limiter compliance buffer
        await new Promise((r) => setTimeout(r, 850));

        // Periodic Milestone Report & Storage Safety Check every 25 items
        if (totalProcessed % 25 === 0) {
          try {
            const currentTotal = await countAcrossVaults(mangaModels);
            const v2MB = (await getVaultLogicalMB(getSecondaryConnection())).toFixed(2);
            const v2bMB = (await getVaultLogicalMB(getVault2BConnection())).toFixed(2);
            const limitMB = getCapacityLimitMB();
            const v2Full = await isVault2Full();
            console.log(`\n📊 --- [Milestone] Processed: ${totalProcessed} | New: ${newlyIngested} | Total (V2+2B): ${currentTotal} | Vault 2: ${v2MB}/${limitMB}MB (Spillover: ${v2Full}) | Vault 2B: ${v2bMB}/512MB ---\n`);

            if (v2Full && (await isVault2BFull())) {
              console.warn(`🛑 [Safety Auto-Pause]: Both Vault 2 and Vault 2B reached >= ${limitMB} MB. Stopping cleanly before 512 MB Atlas limit!`);
              totalProcessed = limit;
              break;
            }
          } catch {}
        }
      }

      currentPassPage++;
      // Inter-page buffer
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Final count across Vault 2 & Vault 2B
  const totalMangaInDb = await countAcrossVaults(mangaModels);

  console.log(`\n======================================================`);
  console.log(`🎉 Omni-Catalog Seeding Complete!`);
  console.log(`📊 Targets Processed: ${totalProcessed}`);
  console.log(`✅ Newly Ingested: ${newlyIngested}`);
  console.log(`⏩ Skipped (Already in DB): ${skippedExisting}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📚 Current Total Reading Catalog in Vault 2: ${totalMangaInDb} titles`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
  process.exit(0);
}

seedManga().catch(async (err) => {
  console.error('Fatal Manga Seeder Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
