import { connectDatabase } from '../config/database.js';
import { anilistService } from '../services/anilistService.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import { Franchise } from '../models/Franchise.js';
import mongoose from 'mongoose';

async function seedYearRange() {
  console.log('🚀 Starting AniNexus Date Range Seeder (2010 - 2026)...');
  await connectDatabase();

  // Parse CLI args: e.g. --start=2010 --end=2026 --perYear=25
  let startYear = 2010;
  let endYear = 2026;
  let perYear = 25;

  process.argv.forEach((arg) => {
    if (arg.startsWith('--start=')) startYear = parseInt(arg.split('=')[1], 10) || 2010;
    if (arg.startsWith('--end=')) endYear = parseInt(arg.split('=')[1], 10) || 2026;
    if (arg.startsWith('--perYear=')) perYear = parseInt(arg.split('=')[1], 10) || 25;
  });

  console.log(`📅 Target Range: ${startYear} to ${endYear} (${perYear} top franchises per year)...`);

  const query = `
    query ($year: Int, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(seasonYear: $year, type: ANIME, sort: [POPULARITY_DESC]) {
          id
          idMal
          title {
            romaji
            english
            native
          }
        }
      }
    }
  `;

  let grandTotalSuccess = 0;
  let grandTotalFailed = 0;

  for (let year = startYear; year <= endYear; year++) {
    console.log(`\n🗓️  Processing Year ${year}...`);
    try {
      const res = await (anilistService as any).fetchGraphQL(query, { year, perPage: perYear });
      const mediaList = res?.Page?.media || [];

      console.log(`   Found ${mediaList.length} candidate franchises for ${year}.`);

      for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        const malId = item.idMal;
        if (!malId) continue;

        // Skip if already in MongoDB Atlas and fresh
        const existing = await Franchise.findOne(
          { 'timeline.ids.malId': malId },
          { _id: 1, 'titles.primary': 1 }
        ).lean();

        if (existing) {
          grandTotalSuccess++;
          console.log(`   [${year} ${i + 1}/${mediaList.length}] ⏩ Already in DB: '${existing.titles?.primary}'`);
          continue;
        }

        try {
          const franchise = await franchiseBuilder.buildFromMalId(malId);
          if (franchise) {
            grandTotalSuccess++;
            console.log(`   [${year} ${i + 1}/${mediaList.length}] ✅ Ingested '${franchise.titles.primary}'`);
          } else {
            grandTotalFailed++;
          }
        } catch (err: any) {
          grandTotalFailed++;
          console.warn(`   [${year} ${i + 1}/${mediaList.length}] ⚠️ Error on ${item.title?.english || item.title?.romaji}:`, err.message);
        }

        // Gentle throttling to respect upstream rate limits
        await new Promise((r) => setTimeout(r, 650));
      }
    } catch (err: any) {
      console.error(`❌ Failed to fetch year ${year}:`, err.message);
    }
  }

  console.log(`\n🎉 Date Range Seeding Complete!`);
  console.log(`✅ Total Franchises Saved: ${grandTotalSuccess}`);
  console.log(`❌ Skipped/Failed: ${grandTotalFailed}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedYearRange().catch(async (err) => {
  console.error('Fatal Range Seeder Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
