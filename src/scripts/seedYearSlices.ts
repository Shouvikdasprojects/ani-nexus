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

async function seedYearSlices() {
  console.log('🚀 Starting AniNexus Deep-History Year-Slice Manga Seeder...');
  await connectDatabase();

  const mangaModels = getAllMangaModels();

  // CLI Arguments
  let startYear = 2026;
  let endYear = 1960;

  for (const arg of process.argv) {
    if (arg.startsWith('--startYear=')) {
      startYear = parseInt(arg.split('=')[1], 10) || 2026;
    }
    if (arg.startsWith('--endYear=')) {
      endYear = parseInt(arg.split('=')[1], 10) || 1960;
    }
  }

  const initialCount = await countAcrossVaults(mangaModels);
  console.log(`📚 Initial Reading Catalog (Vault 2 + Vault 2B): ${initialCount} titles already stored.`);
  console.log(`🎯 Target Range: Years ${startYear} down to ${endYear} (Deep-Archive Sweep)`);

  const perPage = 50;
  let totalProcessed = 0;
  let newlyIngested = 0;
  let skippedExisting = 0;
  let failed = 0;

  console.log(`\n======================================================`);
  console.log(`📦 Commencing Year-by-Year Historical Ingestion into Vault 2`);
  console.log(`======================================================\n`);

  for (let year = startYear; year >= endYear; year--) {
    console.log(`\n📅 >>> Scanning Year Slice: ${year} <<<`);
    let page = 1;
    let yearHasMore = true;

    while (yearHasMore) {
      let pageItems: any[] = [];
      let pageRetries = 0;

      while (pageRetries < 5) {
        try {
          pageItems = await anilistService.getMangaByYear(year, page, perPage);
          break;
        } catch (fetchErr: any) {
          pageRetries++;
          console.warn(`⏳ [Year ${year} Network Glitch]: Page ${page} (${fetchErr.message}). Retrying in 6s (${pageRetries}/5)...`);
          await new Promise((r) => setTimeout(r, 6000));
        }
      }

      if (!pageItems || pageItems.length === 0) {
        console.log(`🏁 Completed Year ${year} at page ${page - 1}.`);
        yearHasMore = false;
        break;
      }

      for (let i = 0; i < pageItems.length; i++) {
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
            console.warn(`⏳ [DB Network Recovery]: ${netErr.message}. Retrying in 5s (${dbRetry}/5)...`);
            await new Promise((r) => setTimeout(r, 5000));
          }
        }

        if (existing) {
          skippedExisting++;
          console.log(`[${year} | P${page}] ⏩ [Already in Vault 2/2B] '${existing.titles.primary}' [${existing.type}]`);
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
                `[${year} | P${page}] ✅ Ingested [${mangaDoc.type}] '${mangaDoc.titles.primary}' (${mangaDoc.chapters || '?'} ch, ${mangaDoc.adaptations.length} anime links) in ${elapsed}s`
              );
            } else {
              failed++;
              ingestSuccess = true;
              console.warn(`[${year} | P${page}] ⚠️ Skipped '${itemTitle}' (no detailed data)`);
            }
          } catch (err: any) {
            ingestRetries++;
            console.warn(`⏳ Ingest retry for '${itemTitle}' (${err.message}) [${ingestRetries}/3]...`);
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        // Rate limiter compliance buffer
        await new Promise((r) => setTimeout(r, 850));

        // Periodic Milestone Report & Storage Safety Check every 50 items
        if (totalProcessed % 50 === 0) {
          try {
            const currentTotal = await countAcrossVaults(mangaModels);
            const v2MB = (await getVaultLogicalMB(getSecondaryConnection())).toFixed(2);
            const v2bMB = (await getVaultLogicalMB(getVault2BConnection())).toFixed(2);
            const limitMB = getCapacityLimitMB();
            const v2Full = await isVault2Full();
            console.log(`\n📊 --- [Year ${year} Milestone] Processed: ${totalProcessed} | New: ${newlyIngested} | Total (V2+2B): ${currentTotal} | Vault 2: ${v2MB}/${limitMB}MB (Spillover: ${v2Full}) | Vault 2B: ${v2bMB}/512MB ---\n`);

            if (v2Full && (await isVault2BFull())) {
              console.warn(`🛑 [Safety Auto-Pause]: Both Vault 2 and Vault 2B reached >= ${limitMB} MB. Exiting safely before 512 MB Atlas limit!`);
              yearHasMore = false;
              year = endYear - 1;
              break;
            }
          } catch {}
        }
      }

      page++;
      // Inter-page buffer
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const finalTotal = await countAcrossVaults(mangaModels);

  console.log(`\n======================================================`);
  console.log(`🎉 Year-Slice Historical Seeding Complete!`);
  console.log(`📊 Targets Processed: ${totalProcessed}`);
  console.log(`✅ Newly Ingested: ${newlyIngested}`);
  console.log(`⏩ Skipped (Already in DB): ${skippedExisting}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📚 Final Reading Catalog in Vault 2: ${finalTotal} titles`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
  process.exit(0);
}

seedYearSlices().catch(async (err) => {
  console.error('Fatal Year Slices Seeder Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
