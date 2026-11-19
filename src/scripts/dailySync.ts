import { connectDatabase } from '../config/database.js';
import { newsService } from '../services/newsService.js';
import { anilistService } from '../services/anilistService.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import mongoose from 'mongoose';

async function runDailySync() {
  console.log('🌅 Starting AniNexus Daily Sync Job...');
  await connectDatabase();

  // 1. Sync Latest News Feeds
  console.log('📰 Syncing Anime News and Editorial Feeds...');
  const newsResult = await newsService.syncFeeds();
  console.log(`   News Synced: ${newsResult.synced}, Skipped: ${newsResult.skipped}`);

  // 2. Sync Current Airing Shows
  console.log('📺 Syncing Airing Schedule & Current Broadcasts...');
  const now = Math.floor(Date.now() / 1000);
  const next3Days = now + 3 * 24 * 60 * 60;
  const schedules = await anilistService.getAiringSchedule(now, next3Days);

  console.log(`   Discovered ${schedules.length} active episodes airing in next 72 hours.`);

  // Ingest/Refresh top 15 currently airing franchises
  let count = 0;
  for (const item of schedules.slice(0, 15)) {
    const malId = item.media?.idMal;
    if (malId) {
      try {
        const doc = await franchiseBuilder.buildFromMalId(malId);
        if (doc) {
          count++;
          console.log(`   🔄 Refreshed broadcasting franchise: ${doc.titles.primary}`);
        }
      } catch (err: any) {
        console.warn(`   ⚠️ Error refreshing airing anime ${malId}:`, err.message);
      }
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  console.log(`\n🎉 Daily Sync Complete! Successfully refreshed ${count} franchises.`);
  await mongoose.disconnect();
  process.exit(0);
}

runDailySync().catch(async (err) => {
  console.error('Fatal Daily Sync Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
