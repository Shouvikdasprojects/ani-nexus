import { connectDatabase, getMangaModel, getVault2BMangaModel } from '../config/database.js';
import { anilistService } from '../services/anilistService.js';
import { mangaBuilder } from '../services/mangaBuilder.js';
import mongoose from 'mongoose';

async function seedYearSlices() {
  console.log('🚀 Starting AniNexus Deep-History Year-Slice Manga Seeder...');
  await connectDatabase();

  const MangaModel = getMangaModel();

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

  const initialCount = await MangaModel.countDocuments();
  console.log(`📚 Initial Vault 2 Catalog: ${initialCount} titles already stored.`);
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

        // 1. Resilient DB existence check
        let existing: any = null;
        let dbRetry = 0;
        while (dbRetry < 5) {
          try {
            existing = await MangaModel.findOne({
              $or: [
                { 'ids.aniId': item.id },
                ...(item.idMal ? [{ 'ids.malId': item.idMal }] : []),
              ],
            }).select('titles slug type');

            if (!existing) {
              const Vault2BManga = getVault2BMangaModel();
              if (Vault2BManga) {
                existing = await Vault2BManga.findOne({
                  $or: [
                    { 'ids.aniId': item.id },
                    ...(item.idMal ? [{ 'ids.malId': item.idMal }] : []),
                  ],
                }).select('titles slug type');
              }
            }
            break;
          } catch (netErr: any) {
            dbRetry++;
            console.warn(`⏳ [DB Network Recovery]: ${netErr.message}. Retrying in 5s (${dbRetry}/5)...`);
            await new Promise((r) => setTimeout(r, 5000));
          }
        }

        if (existing) {
          skippedExisting++;
          console.log(`[${year} | P${page}] ⏩ [Already in Vault 2] '${existing.titles.primary}' [${existing.type}]`);
          continue;
        }

        // 2. Fetch & Ingest full details into Vault 2
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

        // Periodic Milestone Report every 50 items
        if (totalProcessed % 50 === 0) {
          try {
            const currentTotal = await MangaModel.countDocuments();
            console.log(`\n📊 --- [Year Milestone] Processed: ${totalProcessed} | New: ${newlyIngested} | Skipped: ${skippedExisting} | Vault 2 Total: ${currentTotal} titles ---\n`);
          } catch {}
        }
      }

      page++;
      // Inter-page buffer
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const finalTotal = await MangaModel.countDocuments();

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
