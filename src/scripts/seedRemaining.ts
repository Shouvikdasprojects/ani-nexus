import { connectDatabase } from '../config/database.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import mongoose from 'mongoose';

const REMAINING_MAL_IDS = [
  { title: 'Beyblade: Metal Fury', malId: 10476 },
  { title: 'Pokemon: Best Wishes', malId: 9107 },
  { title: 'Cardfight!! Vanguard', malId: 9989 },
  { title: 'Moyashimon Returns', malId: 13015 },
  { title: 'Servant x Service', malId: 18119 },
  { title: 'Flip Flappers', malId: 32979 },
  { title: "Kino's Journey (2017)", malId: 35079 },
  { title: 'Napping Princess (Hirune Hime)', malId: 33025 },
  { title: 'Planet With', malId: 37244 },
  { title: 'Kageki Shojo!!', malId: 42491 },
  { title: 'Platinum End', malId: 44961 },
  { title: 'Orient', malId: 47981 },
];

async function seedRemaining() {
  console.log('🚀 Seeding final remaining standalone franchises...');
  await connectDatabase();

  for (const item of REMAINING_MAL_IDS) {
    try {
      const doc = await franchiseBuilder.buildFromMalId(item.malId);
      if (doc) {
        console.log(`   ✅ Ingested: "${doc.titles.primary}" (${doc.timeline.length} parts)`);
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Error ingesting ${item.title}:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log('🎉 Final remaining franchises seeded!');
  await mongoose.disconnect();
  process.exit(0);
}

seedRemaining().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
