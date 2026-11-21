import { app } from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { newsService } from './services/newsService.js';
import { awardService } from './services/awardService.js';

async function bootstrap() {
  try {
    console.log('🚀 Booting AniNexus API Engine...');
    
    // Connect to MongoDB Atlas
    await connectDatabase();

    const server = app.listen(config.port, () => {
      console.log(`\n==================================================`);
      console.log(`⚡ AniNexus API is LIVE and listening on port ${config.port}`);
      console.log(`📡 URL: http://localhost:${config.port}`);
      console.log(`🛡️  Environment: ${config.env}`);
      console.log(`==================================================\n`);

      // 🔄 Autonomous Background Workers
      setTimeout(async () => {
        try {
          console.log('📰 Running initial autonomous news sync...');
          await newsService.syncFeeds();
          await awardService.pruneOutdatedAwards();
        } catch (e: any) {
          console.warn('[Autonomous Initial Sync Warning]:', e.message);
        }
      }, 10000); // 10s after server boot

      // Sync latest news & articles every 2 hours
      setInterval(async () => {
        try {
          console.log('🔄 Periodic 2-Hour News Sync triggered...');
          await newsService.syncFeeds();
        } catch (e: any) {
          console.warn('[Periodic News Sync Warning]:', e.message);
        }
      }, 2 * 60 * 60 * 1000);

      // Enforce 5-year rolling awards purge once daily (24 hours)
      setInterval(async () => {
        try {
          await awardService.pruneOutdatedAwards();
        } catch (e: any) {
          console.warn('[Periodic Awards Prune Warning]:', e.message);
        }
      }, 24 * 60 * 60 * 1000);
    });

    // Graceful Shutdown
    const shutdown = () => {
      console.log('\n🛑 Gracefully shutting down AniNexus...');
      server.close(() => {
        console.log('💤 AniNexus server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err: any) {
    console.error('💥 Fatal boot error in AniNexus:', err.message);
    process.exit(1);
  }
}

bootstrap();
