import { connectDatabase } from '../config/database.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import { Franchise } from '../models/Franchise.js';
import mongoose from 'mongoose';

// Curated list of landmark anime spanning 1960s to 2000s
const classicLandmarks = [
  { name: 'Cowboy Bebop', malId: 1 },
  { name: 'Neon Genesis Evangelion', malId: 30 },
  { name: 'Dragon Ball', malId: 223 },
  { name: 'Death Note', malId: 1535 },
  { name: 'Code Geass: Lelouch of the Rebellion', malId: 1575 },
  { name: 'Fullmetal Alchemist: Brotherhood', malId: 5114 },
  { name: 'Gurren Lagann', malId: 2001 },
  { name: 'Monster', malId: 19 },
  { name: 'Yu Yu Hakusho', malId: 392 },
  { name: 'Akira', malId: 47 },
  { name: 'Samurai Champloo', malId: 205 },
  { name: 'Great Teacher Onizuka', malId: 245 },
  { name: 'Cardcaptor Sakura', malId: 671 },
  { name: 'Lupin III', malId: 1412 },
  { name: 'Ranma 1/2', malId: 210 },
];

async function seedLandmarks() {
  await connectDatabase();
  console.log(`Starting historical landmark seeding (${classicLandmarks.length} titles)...`);

  let added = 0;
  for (const item of classicLandmarks) {
    try {
      console.log(`\n⏳ Building Franchise: ${item.name} (MAL ID: ${item.malId})...`);
      const franchise = await franchiseBuilder.buildFromMalId(item.malId);
      if (franchise) {
        console.log(`✅ Stored "${franchise.titles.primary}" (Slug: ${franchise.slug})`);
        console.log(`   - Studios: ${franchise.studios?.length || 0}`);
        console.log(`   - Staff: ${franchise.staff?.length || 0}`);
        console.log(`   - Main Characters: ${franchise.mainCharacters?.length || 0}`);
        console.log(`   - Timeline Parts: ${franchise.timeline?.length || 0}`);
        added++;
      } else {
        console.warn(`❌ Failed to build: ${item.name}`);
      }
      // Small pause to be gentle with rate limits
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err: any) {
      console.error(`Error processing ${item.name}:`, err.message);
    }
  }

  const finalTotal = await Franchise.countDocuments();
  console.log(`\n🎉 Landmark seeding completed. Newly added/updated: ${added}. Total franchises in MongoDB Atlas: ${finalTotal}`);
  await mongoose.disconnect();
}

seedLandmarks().catch(console.error);
