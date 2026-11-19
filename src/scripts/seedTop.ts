import { connectDatabase } from '../config/database.js';
import { malService } from '../services/malService.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import mongoose from 'mongoose';

async function seedTopAnime() {
  console.log('🚀 Starting AniNexus Top Master Seeder...');
  await connectDatabase();

  // Parse CLI args: e.g. --limit=250 or default 100
  let limit = 100;
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1], 10) || 100;
  }

  console.log(`🎯 Target: Preloading Top ${limit} Anime Franchises into MongoDB Atlas...`);

  // Fetch top anime from MAL in chunks of 50
  let fetchedCount = 0;
  let offset = 0;
  const pageSize = 50;

  const animeListToSeed: Array<{ id: number; title: string }> = [];

  while (fetchedCount < limit) {
    const curLimit = Math.min(pageSize, limit - fetchedCount);
    const data = await malService.fetchFromMAL(`/anime/ranking?ranking_type=all&limit=${curLimit}&offset=${offset}`);
    
    if (!data?.data || data.data.length === 0) {
      console.warn('⚠️ No more anime returned from rankings ranking_type=all');
      break;
    }

    for (const item of data.data) {
      animeListToSeed.push({
        id: item.node.id,
        title: item.node.title,
      });
    }

    fetchedCount += data.data.length;
    offset += data.data.length;
    console.log(`📋 Discovered ${animeListToSeed.length}/${limit} top anime targets...`);
  }

  console.log(`\n======================================================`);
  console.log(`📦 Commencing Ingestion of ${animeListToSeed.length} franchises into Atlas`);
  console.log(`======================================================\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < animeListToSeed.length; i++) {
    const anime = animeListToSeed[i];
    const startTime = Date.now();
    try {
      const franchise = await franchiseBuilder.buildFromMalId(anime.id);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (franchise) {
        success++;
        console.log(
          `[${i + 1}/${animeListToSeed.length}] ✅ Ingested '${franchise.titles.primary}' (${franchise.timeline.length} parts, ${franchise.totalEpisodes} eps) in ${elapsed}s`
        );
      } else {
        failed++;
        console.warn(`[${i + 1}/${animeListToSeed.length}] ⚠️ Skipped '${anime.title}' (no data)`);
      }
    } catch (err: any) {
      failed++;
      console.error(`[${i + 1}/${animeListToSeed.length}] ❌ Error on '${anime.title}':`, err.message);
    }

    // Gentle throttling to respect upstream rate limits
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`\n🎉 Top Seeder Finished!`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed/Skipped: ${failed}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedTopAnime().catch(async (err) => {
  console.error('Fatal Seeder Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
