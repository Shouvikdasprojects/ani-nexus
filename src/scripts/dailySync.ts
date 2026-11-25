import { connectDatabase } from '../config/database.js';
import { newsService } from '../services/newsService.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import { awardService } from '../services/awardService.js';
import { fetchAndPersistWeeklySchedule } from '../services/scheduleService.js';
import mongoose from 'mongoose';

async function runDailySync() {
  console.log('🌅 Starting AniNexus Daily Sync Job...');
  await connectDatabase();

  // 1. Sync Latest News Feeds
  console.log('📰 Syncing Anime News and Editorial Feeds...');
  const newsResult = await newsService.syncFeeds();
  console.log(`   News Synced: ${newsResult.synced}, Skipped: ${newsResult.skipped}`);

  // 2. Sync & Persist 7-Day Airing Schedule Snapshot to Vault 3
  console.log('📺 Syncing Airing Schedule Snapshot & Current Broadcasts...');
  const { payload, rawSchedules: schedules } = await fetchAndPersistWeeklySchedule();

  console.log(`   Discovered ${schedules.length} active episodes airing in next 7 days (Vault 3 snapshot refreshed: ${payload.totalAiringThisWeek} entries).`);

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

  // 3. Enforce 5-Year Rolling Window for Anime Awards
  console.log('🏆 Enforcing 5-Year Rolling Window for Anime Awards...');
  const awardPruneResult = await awardService.pruneOutdatedAwards();
  console.log(`   Awards Pruning: Cutoff Year is ${awardPruneResult.window.cutoffYear}, Purged: ${awardPruneResult.deletedCount}`);

  console.log(`\n🎉 Daily Sync Complete! Successfully refreshed ${count} franchises.`);
  await mongoose.disconnect();
  process.exit(0);
}

runDailySync().catch(async (err) => {
  console.error('Fatal Daily Sync Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
