import { app } from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';

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
