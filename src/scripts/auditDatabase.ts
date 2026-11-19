import { connectDatabase } from '../config/database.js';
import { Franchise } from '../models/Franchise.js';
import mongoose from 'mongoose';

// Complete target list provided by user (grouped by year)
export const TARGET_ANIME_BY_YEAR: Record<number, string[]> = {
  2010: [
    'Durarara!!', 'Katanagatari', 'Sora no Otoshimono Forte', 'Dance in the Vampire Bund',
    'Baka and Test', 'Seitokai Yakuindomo', 'HeartCatch PreCure!', 'Angel Beats!',
    'The Tatami Galaxy', 'Working!!', 'Maid-sama!', 'K-On!!', 'Giant Killing',
    'Arakawa Under the Bridge', 'Sengoku Basara Two', 'Beyblade: Metal Fury',
    'Highschool of the Dead', 'Shiki', 'Nura: Rise of the Yokai Clan', 'Black Butler II',
    'Strike Witches 2', 'Pokemon: Best Wishes', 'Oreimo', 'Bakuman.', 'Squid Girl',
    'Princess Jellyfish', 'Occult Academy', 'Star Driver', 'Mobile Suit Gundam Unicorn',
    'Arrietty', 'Naruto Shippuden: The Lost Tower', 'Redline', 'Bleach: Hell Verse'
  ],
  2011: [
    'Puella Magi Madoka Magica', 'Wandering Son', 'Gosick', 'Kimi ni Todoke',
    'Beelzebub', 'Cardfight!! Vanguard', 'Steins;Gate', 'Nichijou', 'Hanasaku Iroha',
    'Tiger & Bunny', 'Blue Exorcist', 'Anohana: The Flower We Saw That Day', 'Toriko',
    'Gintama', 'Bunny Drop', "Working'!!", 'Un-Go', 'Fate/Zero', 'Hunter x Hunter',
    'Chihayafuru', 'Persona 4: The Animation', 'Level E', 'Ben-To', 'Future Diary',
    'Children Who Chase Lost Voices', 'Berserk: The Golden Age Arc', 'From Up on Poppy Hill'
  ],
  2012: [
    'Another', "Natsume's Book of Friends", 'Hyouka', 'Jormungand', 'Space Brothers',
    "Kuroko's Basketball", 'Kids on the Slope', 'Accel World', 'Fate/Zero',
    'Nyaruko-san', 'Tsuritama', 'Sword Art Online', 'Tari Tari', 'Moyashimon Returns',
    "JoJo's Bizarre Adventure", 'Psycho-Pass', 'Magi: The Labyrinth of Magic',
    'Little Busters!', 'Love, Chunibyo & Other Delusions', 'Girls und Panzer',
    'Btooom!', 'The Pet Girl of Sakurasou', 'My Little Monster', 'Wolf Children',
    'Evangelion: 3.0 You Can (Not) Redo'
  ],
  2013: [
    'Silver Spoon', 'Love Live! School Idol Project', 'Attack on Titan', 'Valvrave the Liberator',
    'Gargantia on the Verdurous Planet', 'My Teen Romantic Comedy SNAFU',
    'The Devil Is a Part-Timer!', 'A Certain Scientific Railgun S', 'Date A Live',
    'Space Battleship Yamato 2199', 'Free!', 'Monogatari Series Second Season',
    'Gatchaman Crowds', 'Servant x Service', 'Kill la Kill', 'Log Horizon',
    'Kyousougiga', 'Samurai Flamenco', 'Golden Time', 'Gundam Build Fighters',
    'Yowamushi Pedal', 'The Wind Rises', 'Madoka Magica: Rebellion', 'The Tale of the Princess Kaguya'
  ],
  2014: [
    'Nisekoi', 'Noragami', 'Space Dandy', 'One Week Friends', 'Haikyu!!',
    'Mushishi: The Next Chapter', 'Ping Pong the Animation', 'Mekakucity Actors',
    'Knights of Sidonia', 'Black Bullet', 'Tokyo Ghoul', 'Terror in Resonance',
    'Sailor Moon Crystal', 'Barakamon', 'Akame ga Kill!', 'Aldnoah.Zero',
    'Sword Art Online II', 'Blue Spring Ride', 'Your Lie in April', 'Parasyte -the maxim-',
    'Fate/stay night: Unlimited Blade Works', 'Shirobako', 'Hanayamata', 'Terraformars',
    'When Marnie Was There'
  ],
  2015: [
    'Death Parade', 'Assassination Classroom', 'Durarara!!x2', 'Yona of the Dawn',
    'Food Wars!', 'Blood Blockade Battlefront', 'Plastic Memories', 'Sound! Euphonium',
    'My Love Story!!', 'The Heroic Legend of Arslan', 'Charlotte', 'Gate', 'Overlord',
    'Rokka no Yuusha', 'Gangsta.', 'Dragon Ball Super', 'One Punch Man', 'Owarimonogatari',
    'Mobile Suit Gundam: Iron-Blooded Orphans', 'Mr. Osomatsu', 'Miss Hokusai', 'The Boy and the Beast'
  ],
  2016: [
    'KonoSuba', 'Erased', 'Shouwa Genroku Rakugo Shinjuu', 'Ajin', 'Dagashi Kashi',
    'Re:Zero -Starting Life in Another World-', 'My Hero Academia', 'Kabaneri of the Iron Fortress',
    'Bungo Stray Dogs', 'Kiznaiver', 'Mob Psycho 100', '91 Days', 'Orange',
    'Love Live! Sunshine!!', 'Yuri!!! on Ice', 'March Comes in Like a Lion',
    'Flip Flappers', 'Your Name', 'A Silent Voice', 'In This Corner of the World'
  ],
  2017: [
    'Kemono Friends', 'Little Witch Academia', "Miss Kobayashi's Dragon Maid",
    'Re:Creators', 'Eromanga Sensei', 'Tsuki ga Kirei', 'Boruto: Naruto Next Generations',
    'Made in Abyss', 'Classroom of the Elite', 'Princess Principal', 'Fate/Apocrypha',
    'Berserk', 'Welcome to the Ballroom', 'Land of the Lustrous', "The Ancient Magus' Bride",
    "Kino's Journey", 'Black Clover', 'Fireworks', 'Napping Princess'
  ],
  2018: [
    'Violet Evergarden', 'Devilman Crybaby', 'A Place Further Than the Universe',
    'Darling in the FranXX', 'Steins;Gate 0', 'Hinamatsuri', 'Golden Kamuy',
    'Megalobox', 'Tokyo Ghoul:re', 'Persona 5: The Animation', 'Cells at Work!',
    'Banana Fish', 'Overlord III', "JoJo's Bizarre Adventure: Golden Wind",
    'Rascal Does Not Dream of Bunny Girl Senpai', 'Zombie Land Saga', 'Run with the Wind',
    'That Time I Got Reincarnated as a Slime', 'Planet With', 'Maquia: When the Promised Flower Blooms',
    'Mirai', 'Penguin Highway', 'Dragon Ball Super: Broly'
  ],
  2019: [
    'Kaguya-sama: Love Is War', 'The Promised Neverland', 'Dororo',
    'Demon Slayer: Kimetsu no Yaiba', 'Fruits Basket', 'Sarazanmai', 'Vinland Saga',
    'Fire Force', 'Dr. Stone', 'Cautious Hero', 'Beastars', 'Psycho-Pass 3',
    'Promare', 'Children of the Sea', 'Weathering With You', 'Hello World'
  ],
  2020: [
    'Appare-Ranman!', 'Kakushigoto', 'Rent-a-Girlfriend', 'Dorohedoro',
    'Great Pretender', 'Jujutsu Kaisen', 'Higurashi: When They Cry - GOU',
    'Josee, the Tiger and the Fish'
  ],
  2021: [
    'Mushoku Tensei: Jobless Reincarnation', 'Horimiya', 'Wonder Egg Priority',
    'SK8 the Infinity', '86 -Eighty Six-', "Vivy: Fluorite Eye's Song", 'Odd Taxi',
    'Tokyo Revengers', 'Shaman King', 'Sonny Boy', 'Mieruko-chan', 'Kageki Shojo!!',
    'Ranking of Kings', "Komi Can't Communicate", 'Blue Period', 'Platinum End',
    'Belle'
  ],
  2022: [
    'My Dress-Up Darling', 'Spy x Family', 'Orient', 'Lycoris Recoil',
    'Call of the Night', 'Cyberpunk: Edgerunners', 'Chainsaw Man', 'Bocchi the Rock!',
    'Bleach: Thousand-Year Blood War', 'Blue Lock', 'Mobile Suit Gundam: The Witch from Mercury',
    'Inu-Oh', 'The First Slam Dunk'
  ],
  2023: [
    'Trigun Stampede', 'Oshi no Ko', "Hell's Paradise", 'Skip and Loafer',
    'Mashle: Magic and Muscles', 'The Dangers in My Heart', 'Heavenly Delusion',
    'My Happy Marriage', 'Zom 100: Bucket List of the Dead', "Frieren: Beyond Journey's End",
    'The Apothecary Diaries', 'Undead Unluck', 'Pluto', 'Shangri-La Frontier',
    'Detective Conan: Black Iron Submarine'
  ],
  2024: [
    'Solo Leveling', 'Delicious in Dungeon', 'Kaiju No. 8', 'Wind Breaker',
    'Fairy Tail: 100 Years Quest', 'Dandadan', 'Look Back', 'The Colors Within',
    'Detective Conan: The Million-dollar Pentagram'
  ],
  2025: [
    'Sakamoto Days', 'Gachiakuta', 'To Your Eternity', 'Chainsaw Man - The Movie: Reze Arc'
  ],
  2026: [
    "Frieren: Beyond Journey's End Season 2",
    'Jujutsu Kaisen Season 3: The Culling Game',
    'Oshi no Ko Season 3',
    'Bleach: Thousand-Year Blood War Part 4',
    'Re:Zero Season 4',
    'Fire Force Season 3 Part 2',
    'One Punch Man Season 3',
    'Demon Slayer: Infinity Castle Movie 2'
  ]
};

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function auditDatabase() {
  console.log('🔍 Connecting to MongoDB Atlas AniNexus Vault to check anime collection...');
  await connectDatabase();

  const allFranchises = await Franchise.find()
    .select('slug titles timeline')
    .lean();

  console.log(`📦 Loaded ${allFranchises.length} master franchises from MongoDB.`);

  // Create a fast lookup search index of all known titles & timeline parts
  const franchisePool = allFranchises.map((f) => {
    const titleStrings: string[] = [
      f.slug,
      f.titles.primary,
      f.titles.romaji || '',
      f.titles.native || '',
      ...(f.titles.synonyms || []),
    ];

    if (f.timeline && Array.isArray(f.timeline)) {
      f.timeline.forEach((item: any) => {
        if (item.titles) {
          if (item.titles.primary) titleStrings.push(item.titles.primary);
          if (item.titles.romaji) titleStrings.push(item.titles.romaji);
          if (item.titles.synonyms) titleStrings.push(...item.titles.synonyms);
        }
      });
    }

    return {
      slug: f.slug,
      primary: f.titles.primary,
      normalizedTerms: titleStrings
        .map(normalize)
        .filter((t) => t && t.length >= 3),
    };
  });

  function isPresent(animeName: string): { found: boolean; matchedFranchise?: string } {
    const targetNorm = normalize(animeName);
    if (!targetNorm || targetNorm.length < 3) return { found: false };

    for (const item of franchisePool) {
      for (const term of item.normalizedTerms) {
        // Exact match or high-confidence substring for titles >= 5 chars
        if (
          term === targetNorm ||
          (term.length >= 6 && targetNorm.length >= 6 && (term.includes(targetNorm) || targetNorm.includes(term)))
        ) {
          return { found: true, matchedFranchise: item.primary };
        }
      }
    }
    return { found: false };
  }

  const report: Record<number, { total: number; found: string[]; missing: string[] }> = {};
  let totalTargetAnime = 0;
  let totalFound = 0;
  let totalMissing = 0;

  for (const yearStr of Object.keys(TARGET_ANIME_BY_YEAR)) {
    const year = parseInt(yearStr, 10);
    const list = TARGET_ANIME_BY_YEAR[year];
    const foundList: string[] = [];
    const missingList: string[] = [];

    for (const anime of list) {
      totalTargetAnime++;
      const result = isPresent(anime);
      if (result.found) {
        totalFound++;
        foundList.push(`${anime} -> [${result.matchedFranchise}]`);
      } else {
        totalMissing++;
        missingList.push(anime);
      }
    }

    report[year] = {
      total: list.length,
      found: foundList,
      missing: missingList,
    };
  }

  console.log('\n======================================================');
  console.log(`📊 ANINEXUS DATABASE AUDIT REPORT (2010 - 2026)`);
  console.log(`🎯 Total Anime Checked: ${totalTargetAnime}`);
  console.log(`✅ Present in MongoDB: ${totalFound} (${Math.round((totalFound / totalTargetAnime) * 100)}%)`);
  console.log(`❌ Missing from MongoDB: ${totalMissing} (${Math.round((totalMissing / totalTargetAnime) * 100)}%)`);
  console.log('======================================================\n');

  for (const [year, data] of Object.entries(report)) {
    console.log(`📅 Year ${year} (${data.found.length}/${data.total} Present)`);
    if (data.missing.length > 0) {
      console.log(`   ❌ Missing (${data.missing.length}): ${data.missing.join(', ')}`);
    } else {
      console.log(`   ✅ All ${data.total} anime present!`);
    }
  }

  await mongoose.disconnect();
}

auditDatabase().catch(async (err) => {
  console.error('Audit Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
