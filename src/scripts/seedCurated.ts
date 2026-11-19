import { connectDatabase } from '../config/database.js';
import { Franchise } from '../models/Franchise.js';
import { malService } from '../services/malService.js';
import { anilistService } from '../services/anilistService.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import mongoose from 'mongoose';

// Target list of curated anime from 2010 to 2026
const CURATED_LIST: { year: number; title: string }[] = [
  // 2010
  { year: 2010, title: 'Durarara!!' },
  { year: 2010, title: 'Katanagatari' },
  { year: 2010, title: 'Sora no Otoshimono Forte' },
  { year: 2010, title: 'Dance in the Vampire Bund' },
  { year: 2010, title: 'HeartCatch PreCure!' },
  { year: 2010, title: 'Working!!' },
  { year: 2010, title: 'Giant Killing' },
  { year: 2010, title: 'Arakawa Under the Bridge' },
  { year: 2010, title: 'Sengoku Basara Two' },
  { year: 2010, title: 'Highschool of the Dead' },
  { year: 2010, title: 'Shiki' },
  { year: 2010, title: 'Nura: Rise of the Yokai Clan' },
  { year: 2010, title: 'Black Butler II' },
  { year: 2010, title: 'Strike Witches 2' },
  { year: 2010, title: 'Squid Girl' },
  { year: 2010, title: 'Princess Jellyfish' },
  { year: 2010, title: 'Occult Academy' },
  { year: 2010, title: 'Star Driver' },
  { year: 2010, title: 'Mobile Suit Gundam Unicorn' },
  { year: 2010, title: 'The Secret World of Arrietty' },
  { year: 2010, title: 'Redline' },

  // 2011
  { year: 2011, title: 'Puella Magi Madoka Magica' },
  { year: 2011, title: 'Wandering Son' },
  { year: 2011, title: 'Kimi ni Todoke' },
  { year: 2011, title: 'Beelzebub' },
  { year: 2011, title: 'Nichijou' },
  { year: 2011, title: 'Hanasaku Iroha' },
  { year: 2011, title: 'Tiger & Bunny' },
  { year: 2011, title: 'Blue Exorcist' },
  { year: 2011, title: 'Anohana: The Flower We Saw That Day' },
  { year: 2011, title: 'Toriko' },
  { year: 2011, title: 'Gintama' },
  { year: 2011, title: 'Bunny Drop' },
  { year: 2011, title: 'Un-Go' },
  { year: 2011, title: 'Level E' },
  { year: 2011, title: 'Ben-To' },
  { year: 2011, title: 'Children Who Chase Lost Voices' },
  { year: 2011, title: 'Berserk: The Golden Age Arc' },
  { year: 2011, title: 'From Up on Poppy Hill' },

  // 2012
  { year: 2012, title: 'Natsume Yuujinchou Shi' },
  { year: 2012, title: 'Jormungand' },
  { year: 2012, title: 'Space Brothers' },
  { year: 2012, title: 'Kids on the Slope' },
  { year: 2012, title: 'Accel World' },
  { year: 2012, title: 'Nyaruko-san' },
  { year: 2012, title: 'Tsuritama' },
  { year: 2012, title: 'Tari Tari' },
  { year: 2012, title: 'Little Busters!' },
  { year: 2012, title: 'Girls und Panzer' },
  { year: 2012, title: 'Btooom!' },
  { year: 2012, title: 'Wolf Children' },

  // 2013
  { year: 2013, title: 'Silver Spoon' },
  { year: 2013, title: 'Love Live! School Idol Project' },
  { year: 2013, title: 'Valvrave the Liberator' },
  { year: 2013, title: 'Gargantia on the Verdurous Planet' },
  { year: 2013, title: 'A Certain Scientific Railgun S' },
  { year: 2013, title: 'Space Battleship Yamato 2199' },
  { year: 2013, title: 'Gatchaman Crowds' },
  { year: 2013, title: 'Kyousougiga' },
  { year: 2013, title: 'Samurai Flamenco' },
  { year: 2013, title: 'Gundam Build Fighters' },
  { year: 2013, title: 'Yowamushi Pedal' },
  { year: 2013, title: 'The Wind Rises' },
  { year: 2013, title: 'The Tale of the Princess Kaguya' },

  // 2014
  { year: 2014, title: 'Space Dandy' },
  { year: 2014, title: 'One Week Friends' },
  { year: 2014, title: 'Mushishi: The Next Chapter' },
  { year: 2014, title: 'Mekakucity Actors' },
  { year: 2014, title: 'Knights of Sidonia' },
  { year: 2014, title: 'Black Bullet' },
  { year: 2014, title: 'Sailor Moon Crystal' },
  { year: 2014, title: 'Barakamon' },
  { year: 2014, title: 'Akame ga Kill!' },
  { year: 2014, title: 'Tokyo Ghoul' },
  { year: 2014, title: 'Aldnoah.Zero' },
  { year: 2014, title: 'Shirobako' },
  { year: 2014, title: 'Hanayamata' },
  { year: 2014, title: 'Terraformars' },
  { year: 2014, title: 'When Marnie Was There' },

  // 2015
  { year: 2015, title: 'Yona of the Dawn' },
  { year: 2015, title: 'Blood Blockade Battlefront' },
  { year: 2015, title: 'Sound! Euphonium' },
  { year: 2015, title: 'The Heroic Legend of Arslan' },
  { year: 2015, title: 'Charlotte' },
  { year: 2015, title: 'Gate' },
  { year: 2015, title: 'Rokka: Braves of the Six Flowers' },
  { year: 2015, title: 'Gangsta.' },
  { year: 2015, title: 'Dragon Ball Super' },
  { year: 2015, title: 'Mobile Suit Gundam: Iron-Blooded Orphans' },
  { year: 2015, title: 'Mr. Osomatsu' },
  { year: 2015, title: 'Miss Hokusai' },
  { year: 2015, title: 'The Boy and the Beast' },

  // 2016
  { year: 2016, title: 'Shouwa Genroku Rakugo Shinjuu' },
  { year: 2016, title: 'Ajin: Demi-Human' },
  { year: 2016, title: 'Dagashi Kashi' },
  { year: 2016, title: 'Kabaneri of the Iron Fortress' },
  { year: 2016, title: 'Bungo Stray Dogs' },
  { year: 2016, title: 'Kiznaiver' },
  { year: 2016, title: '91 Days' },
  { year: 2016, title: 'Orange' },
  { year: 2016, title: 'Love Live! Sunshine!!' },
  { year: 2016, title: 'Yuri!!! on Ice' },
  { year: 2016, title: 'March Comes in Like a Lion' },
  { year: 2016, title: 'Your Name.' },
  { year: 2016, title: 'A Silent Voice' },
  { year: 2016, title: 'In This Corner of the World' },

  // 2017
  { year: 2017, title: 'Kemono Friends' },
  { year: 2017, title: 'Little Witch Academia' },
  { year: 2017, title: 'Re:Creators' },
  { year: 2017, title: 'Eromanga Sensei' },
  { year: 2017, title: 'Tsuki ga Kirei' },
  { year: 2017, title: 'Princess Principal' },
  { year: 2017, title: 'Fate/Apocrypha' },
  { year: 2017, title: 'Berserk 2nd Season' },
  { year: 2017, title: 'Welcome to the Ballroom' },
  { year: 2017, title: 'Land of the Lustrous' },
  { year: 2017, title: "The Ancient Magus' Bride" },
  { year: 2017, title: 'Black Clover' },
  { year: 2017, title: 'Fireworks' },

  // 2018
  { year: 2018, title: 'A Place Further Than the Universe' },
  { year: 2018, title: 'Hinamatsuri' },
  { year: 2018, title: 'Golden Kamuy' },
  { year: 2018, title: 'Megalobox' },
  { year: 2018, title: 'Cells at Work!' },
  { year: 2018, title: 'Zombie Land Saga' },
  { year: 2018, title: 'Run with the Wind' },
  { year: 2018, title: 'Maquia: When the Promised Flower Blooms' },
  { year: 2018, title: 'Mirai' },
  { year: 2018, title: 'Penguin Highway' },
  { year: 2018, title: 'Dragon Ball Super: Broly' },

  // 2019
  { year: 2019, title: 'Sarazanmai' },
  { year: 2019, title: 'Cautious Hero: The Hero Is Overpowered but Overly Cautious' },
  { year: 2019, title: 'Beastars' },
  { year: 2019, title: 'Dororo' },
  { year: 2019, title: 'Promare' },
  { year: 2019, title: 'Children of the Sea' },
  { year: 2019, title: 'Weathering With You' },
  { year: 2019, title: 'Hello World' },

  // 2020
  { year: 2020, title: 'Appare-Ranman!' },
  { year: 2020, title: 'Kakushigoto' },
  { year: 2020, title: 'Dorohedoro' },
  { year: 2020, title: 'Great Pretender' },
  { year: 2020, title: 'Higurashi: When They Cry - GOU' },
  { year: 2020, title: 'Josee, the Tiger and the Fish' },

  // 2021
  { year: 2021, title: 'Wonder Egg Priority' },
  { year: 2021, title: 'SK8 the Infinity' },
  { year: 2021, title: "Vivy: Fluorite Eye's Song" },
  { year: 2021, title: 'Odd Taxi' },
  { year: 2021, title: 'Shaman King' },
  { year: 2021, title: 'Sonny Boy' },
  { year: 2021, title: 'Mieruko-chan' },
  { year: 2021, title: 'Ranking of Kings' },
  { year: 2021, title: "Komi Can't Communicate" },
  { year: 2021, title: 'Blue Period' },
  { year: 2021, title: 'Belle' },

  // 2022
  { year: 2022, title: 'Lycoris Recoil' },
  { year: 2022, title: 'Call of the Night' },
  { year: 2022, title: 'Cyberpunk: Edgerunners' },
  { year: 2022, title: 'Mobile Suit Gundam: The Witch from Mercury' },
  { year: 2022, title: 'Inu-Oh' },
  { year: 2022, title: 'The First Slam Dunk' },

  // 2023
  { year: 2023, title: 'Trigun Stampede' },
  { year: 2023, title: 'Skip and Loafer' },
  { year: 2023, title: 'The Dangers in My Heart' },
  { year: 2023, title: 'My Happy Marriage' },
  { year: 2023, title: 'Undead Unluck' },
  { year: 2023, title: 'Pluto' },
  { year: 2023, title: 'Shangri-La Frontier' },
  { year: 2023, title: 'Detective Conan: Black Iron Submarine' },

  // 2024
  { year: 2024, title: 'Wind Breaker' },
  { year: 2024, title: 'Fairy Tail: 100 Years Quest' },
  { year: 2024, title: 'Look Back' },
  { year: 2024, title: 'The Colors Within' },
  { year: 2024, title: 'Detective Conan: The Million-dollar Pentagram' },

  // 2025 & 2026 Seasonal Additions
  { year: 2026, title: 'One Punch Man Season 3' },
  { year: 2026, title: 'Hell’s Paradise Season 2' },
];

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function seedCurated() {
  console.log('🌟 Starting AniNexus Curated Historical & Seasonal Anime Seeder...');
  await connectDatabase();

  // Load existing slugs and titles to avoid duplicate work
  const existingDocs = await Franchise.find().select('slug titles.primary titles.romaji').lean();
  const existingSet = new Set<string>();

  existingDocs.forEach((d) => {
    existingSet.add(normalize(d.slug));
    existingSet.add(normalize(d.titles.primary));
    if (d.titles.romaji) existingSet.add(normalize(d.titles.romaji));
  });

  console.log(`📦 Found ${existingDocs.length} franchises already present in MongoDB.`);

  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < CURATED_LIST.length; i++) {
    const item = CURATED_LIST[i];
    const norm = normalize(item.title);

    // Check if already present
    let alreadyExists = false;
    for (const key of existingSet) {
      if (key === norm || (norm.length >= 6 && key.length >= 6 && (key.includes(norm) || norm.includes(key)))) {
        alreadyExists = true;
        break;
      }
    }

    if (alreadyExists) {
      skipped++;
      console.log(`[${i + 1}/${CURATED_LIST.length}] ⏭️  [${item.year}] Already exists: "${item.title}"`);
      continue;
    }

    console.log(`[${i + 1}/${CURATED_LIST.length}] 🔍 [${item.year}] Resolving "${item.title}"...`);

    // 1. Try MAL Search
    let malId: number | null = null;
    try {
      const malResults = await malService.searchAnime(item.title, 5);
      if (malResults && malResults.length > 0) {
        malId = malResults[0].id;
      }
    } catch (e: any) {
      // ignore
    }

    // 2. If not found on MAL, try AniList Search
    if (!malId) {
      try {
        const alResults = await anilistService.searchAnime(item.title);
        if (alResults && alResults.length > 0 && alResults[0].idMal) {
          malId = alResults[0].idMal;
        }
      } catch (e: any) {
        // ignore
      }
    }

    if (!malId) {
      console.warn(`   ⚠️ Could not resolve MAL ID for "${item.title}"`);
      failed++;
      continue;
    }

    // Ingest Master Franchise Document
    try {
      const doc = await franchiseBuilder.buildFromMalId(malId);
      if (doc) {
        ingested++;
        existingSet.add(normalize(doc.slug));
        existingSet.add(normalize(doc.titles.primary));
        console.log(`   ✅ Ingested: "${doc.titles.primary}" (${doc.timeline.length} parts)`);
      } else {
        failed++;
        console.warn(`   ❌ Failed to build franchise for ID ${malId}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`   ❌ Ingestion error for "${item.title}" (ID ${malId}):`, err.message);
    }

    // Gentle throttling to maintain healthy rate-limiting
    await new Promise((r) => setTimeout(r, 650));
  }

  console.log('\n======================================================');
  console.log(`🎉 Curated Ingestion Complete!`);
  console.log(`   ✅ Newly Ingested: ${ingested}`);
  console.log(`   ⏭️  Already Present (Skipped): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

seedCurated().catch(async (err) => {
  console.error('Fatal Curated Seeder Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
