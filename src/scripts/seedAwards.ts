import { connectDatabase } from '../config/database.js';
import { awardService } from '../services/awardService.js';
import { Award } from '../models/Award.js';
import mongoose from 'mongoose';

const AWARDS_DATA = [
  {
    awardName: 'Crunchyroll Anime Awards',
    edition: '10th Annual Anime Awards (2026)',
    year: 2026,
    slug: 'crunchyroll-anime-awards-2026',
    status: 'completed' as const,
    ceremonyDate: 'March 2026',
    location: 'Grand Prince Hotel New Takanawa, Tokyo, Japan',
    bannerImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
    categories: [
      {
        name: 'Anime of the Year',
        slug: 'anime-of-the-year',
        description: 'Honoring the overall best anime television series of the 2025/2026 broadcast period.',
        winner: {
          title: { english: "Frieren: Beyond Journey's End", romaji: 'Sousou no Frieren' },
          franchiseSlug: 'frieren-beyond-journeys-end',
          malId: 52991,
          anilistId: 154587,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
          nomineeName: "Frieren: Beyond Journey's End",
          details: 'Produced by Studio Madhouse',
          isWinner: true,
        },
        nominees: [
          {
            title: { english: "Frieren: Beyond Journey's End", romaji: 'Sousou no Frieren' },
            franchiseSlug: 'frieren-beyond-journeys-end',
            malId: 52991,
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
            isWinner: true,
          },
          {
            title: { english: 'Solo Leveling', romaji: 'Ore dake Level Up na Ken' },
            franchiseSlug: 'solo-leveling',
            malId: 52299,
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1844/140026.jpg',
            isWinner: false,
          },
          {
            title: { english: 'Dandadan', romaji: 'Dandadan' },
            franchiseSlug: 'dandadan',
            malId: 57334,
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1826/145451.jpg',
            isWinner: false,
          },
          {
            title: { english: 'Kaiju No. 8', romaji: 'Kaijuu 8-gou' },
            franchiseSlug: 'kaiju-no-8',
            malId: 52588,
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1484/142079.jpg',
            isWinner: false,
          },
          {
            title: { english: 'Delicious in Dungeon', romaji: 'Dungeon Meshi' },
            franchiseSlug: 'delicious-in-dungeon',
            malId: 52701,
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1429/140510.jpg',
            isWinner: false,
          },
          {
            title: { english: 'Re:ZERO -Starting Life in Another World- Season 3', romaji: 'Re:Zero kara Hajimeru Isekai Seikatsu 3rd Season' },
            franchiseSlug: 'rezero-starting-life-in-another-world',
            malId: 54857,
            imageUrl: 'https://cdn.myanimelist.net/images/anime/1018/143588.jpg',
            isWinner: false,
          },
        ],
      },
      {
        name: 'Best Animation',
        slug: 'best-animation',
        description: 'Excellence in visual artistry, fluidity, kinetic movement, and dynamic sakuga choreography.',
        winner: {
          title: { english: 'Demon Slayer: Kimetsu no Yaiba - Hashira Training Arc', romaji: 'Kimetsu no Yaiba: Hashira Geiko-hen' },
          franchiseSlug: 'demon-slayer-kimetsu-no-yaiba',
          malId: 55701,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1460/142277.jpg',
          nomineeName: 'Demon Slayer: Kimetsu no Yaiba - Hashira Training Arc',
          details: 'ufotable',
          isWinner: true,
        },
        nominees: [
          {
            title: { english: 'Demon Slayer: Kimetsu no Yaiba - Hashira Training Arc', romaji: 'Kimetsu no Yaiba: Hashira Geiko-hen' },
            franchiseSlug: 'demon-slayer-kimetsu-no-yaiba',
            malId: 55701,
            isWinner: true,
          },
          {
            title: { english: 'Dandadan', romaji: 'Dandadan' },
            franchiseSlug: 'dandadan',
            malId: 57334,
            isWinner: false,
          },
          {
            title: { english: 'Solo Leveling', romaji: 'Ore dake Level Up na Ken' },
            franchiseSlug: 'solo-leveling',
            malId: 52299,
            isWinner: false,
          },
          {
            title: { english: 'Bleach: Thousand-Year Blood War - The Conflict', romaji: 'Bleach: Sennen Kessen-hen - Soukoku-tan' },
            franchiseSlug: 'bleach',
            malId: 56784,
            isWinner: false,
          },
        ],
      },
      {
        name: 'Best Action',
        slug: 'best-action',
        description: 'The highest standard of adrenaline, high-stakes combat, and tactical confrontation.',
        winner: {
          title: { english: 'Solo Leveling', romaji: 'Ore dake Level Up na Ken' },
          franchiseSlug: 'solo-leveling',
          malId: 52299,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1844/140026.jpg',
          details: 'A-1 Pictures',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Solo Leveling', romaji: 'Ore dake Level Up na Ken' }, isWinner: true },
          { title: { english: 'Kaiju No. 8', romaji: 'Kaijuu 8-gou' }, isWinner: false },
          { title: { english: 'Dandadan', romaji: 'Dandadan' }, isWinner: false },
          { title: { english: 'Wind Breaker', romaji: 'Wind Breaker' }, isWinner: false },
        ],
      },
      {
        name: 'Best Opening Sequence',
        slug: 'best-opening-sequence',
        description: 'Outstanding musical composition and thematic motion graphics in an opening sequence.',
        winner: {
          title: { english: 'Mashle: Magic and Muscles Season 2', romaji: 'Mashle: Kami Shinkakusha Kouho Senbatsu Shiken-hen' },
          franchiseSlug: 'mashle-magic-and-muscles',
          malId: 54581,
          nomineeName: 'Bling-Bang-Bang-Born',
          details: 'Performed by Creepy Nuts',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Mashle Season 2' }, nomineeName: 'Bling-Bang-Bang-Born by Creepy Nuts', isWinner: true },
          { title: { english: 'Dandadan' }, nomineeName: 'Otonoke by Creepy Nuts', isWinner: false },
          { title: { english: 'Kaiju No. 8' }, nomineeName: 'Abyss by YUNGBLUD', isWinner: false },
          { title: { english: 'Solo Leveling' }, nomineeName: 'LEveL by SawanoHiroyuki[nZk]:TXT', isWinner: false },
        ],
      },
      {
        name: 'Best Film',
        slug: 'best-film',
        description: 'Cinematic excellence in animated feature films released globally in theaters.',
        winner: {
          title: { english: 'Haikyu!! The Dumpster Battle', romaji: 'Gekijouban Haikyuu!! Gomi Suteba no Kessen' },
          franchiseSlug: 'haikyu',
          malId: 52742,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1792/141088.jpg',
          details: 'Production I.G',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Haikyu!! The Dumpster Battle' }, isWinner: true },
          { title: { english: 'Look Back' }, isWinner: false },
          { title: { english: 'Spy x Family Code: White' }, isWinner: false },
        ],
      },
    ],
  },
  {
    awardName: 'Crunchyroll Anime Awards',
    edition: '9th Annual Anime Awards (2025)',
    year: 2025,
    slug: 'crunchyroll-anime-awards-2025',
    status: 'completed' as const,
    ceremonyDate: 'March 2, 2025',
    location: 'Grand Prince Hotel New Takanawa, Tokyo, Japan',
    bannerImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
    categories: [
      {
        name: 'Anime of the Year',
        slug: 'anime-of-the-year',
        description: 'Honoring the most influential, culturally impactful anime masterwork.',
        winner: {
          title: { english: "Frieren: Beyond Journey's End", romaji: 'Sousou no Frieren' },
          franchiseSlug: 'frieren-beyond-journeys-end',
          malId: 52991,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
          details: 'Studio Madhouse',
          isWinner: true,
        },
        nominees: [
          { title: { english: "Frieren: Beyond Journey's End" }, isWinner: true },
          { title: { english: 'Jujutsu Kaisen Season 2' }, isWinner: false },
          { title: { english: 'Solo Leveling' }, isWinner: false },
          { title: { english: 'Oshi no Ko Season 2' }, isWinner: false },
          { title: { english: 'Delicious in Dungeon' }, isWinner: false },
        ],
      },
      {
        name: 'Best Animation',
        slug: 'best-animation',
        description: 'Excellence in visual artistry, kinetic direction, and compositing.',
        winner: {
          title: { english: 'Jujutsu Kaisen Season 2', romaji: 'Jujutsu Kaisen 2nd Season' },
          franchiseSlug: 'jujutsu-kaisen',
          malId: 51009,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1792/138022.jpg',
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen Season 2' }, isWinner: true },
          { title: { english: "Frieren: Beyond Journey's End" }, isWinner: false },
          { title: { english: 'Demon Slayer Hashira Training Arc' }, isWinner: false },
        ],
      },
      {
        name: 'Best Action',
        slug: 'best-action',
        description: 'High-octane choreography and cinematic showdowns.',
        winner: {
          title: { english: 'Jujutsu Kaisen Season 2', romaji: 'Jujutsu Kaisen 2nd Season' },
          franchiseSlug: 'jujutsu-kaisen',
          malId: 51009,
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen Season 2' }, isWinner: true },
          { title: { english: 'Solo Leveling' }, isWinner: false },
          { title: { english: 'Bleach: Thousand-Year Blood War' }, isWinner: false },
        ],
      },
      {
        name: 'Best Opening Sequence',
        slug: 'best-opening-sequence',
        description: 'Outstanding musical composition and aesthetic direction.',
        winner: {
          title: { english: 'Jujutsu Kaisen Season 2' },
          nomineeName: 'Specialz',
          details: 'Performed by King Gnu',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen Season 2' }, nomineeName: 'Specialz by King Gnu', isWinner: true },
          { title: { english: 'Oshi no Ko' }, nomineeName: 'Idol by YOASOBI', isWinner: false },
          { title: { english: "Frieren: Beyond Journey's End" }, nomineeName: 'Yuusha by YOASOBI', isWinner: false },
        ],
      },
      {
        name: 'Best Film',
        slug: 'best-film',
        description: 'Outstanding theatrical anime motion picture.',
        winner: {
          title: { english: 'The Boy and the Heron', romaji: 'Kimitachi wa Dou Ikiru ka' },
          franchiseSlug: 'the-boy-and-the-heron',
          malId: 36098,
          details: 'Studio Ghibli (Directed by Hayao Miyazaki)',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'The Boy and the Heron' }, isWinner: true },
          { title: { english: 'Suzume' }, isWinner: false },
          { title: { english: 'The First Slam Dunk' }, isWinner: false },
        ],
      },
    ],
  },
  {
    awardName: 'Crunchyroll Anime Awards',
    edition: '8th Annual Anime Awards (2024)',
    year: 2024,
    slug: 'crunchyroll-anime-awards-2024',
    status: 'completed' as const,
    ceremonyDate: 'March 2, 2024',
    location: 'Grand Prince Hotel New Takanawa, Tokyo, Japan',
    bannerImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',
    categories: [
      {
        name: 'Anime of the Year',
        slug: 'anime-of-the-year',
        description: 'The premier honor celebrating the finest anime of 2023/2024.',
        winner: {
          title: { english: 'Jujutsu Kaisen Season 2', romaji: 'Jujutsu Kaisen 2nd Season' },
          franchiseSlug: 'jujutsu-kaisen',
          malId: 51009,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1792/138022.jpg',
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen Season 2' }, isWinner: true },
          { title: { english: 'Chainsaw Man' }, isWinner: false },
          { title: { english: 'Demon Slayer: Swordsmith Village Arc' }, isWinner: false },
          { title: { english: 'Bocchi the Rock!' }, isWinner: false },
          { title: { english: 'Attack on Titan Final Season THE FINAL CHAPTERS' }, isWinner: false },
          { title: { english: 'Vinland Saga Season 2' }, isWinner: false },
        ],
      },
      {
        name: 'Best Animation',
        slug: 'best-animation',
        description: 'Benchmark standard of animation craftsmanship.',
        winner: {
          title: { english: 'Demon Slayer: Kimetsu no Yaiba Swordsmith Village Arc' },
          franchiseSlug: 'demon-slayer-kimetsu-no-yaiba',
          malId: 51019,
          details: 'ufotable',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Demon Slayer: Kimetsu no Yaiba Swordsmith Village Arc' }, isWinner: true },
          { title: { english: 'Jujutsu Kaisen Season 2' }, isWinner: false },
          { title: { english: 'Chainsaw Man' }, isWinner: false },
          { title: { english: 'Mob Psycho 100 III' }, isWinner: false },
        ],
      },
      {
        name: 'Best Action',
        slug: 'best-action',
        description: 'Pinnacle of kinetic and exhilarating fight sequences.',
        winner: {
          title: { english: 'Jujutsu Kaisen Season 2' },
          franchiseSlug: 'jujutsu-kaisen',
          malId: 51009,
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen Season 2' }, isWinner: true },
          { title: { english: 'Attack on Titan Final Season' }, isWinner: false },
          { title: { english: 'Bleach: Thousand-Year Blood War' }, isWinner: false },
          { title: { english: 'Chainsaw Man' }, isWinner: false },
        ],
      },
      {
        name: 'Best Opening Sequence',
        slug: 'best-opening-sequence',
        description: 'Exceptional musical composition and opening sequence animation.',
        winner: {
          title: { english: 'Jujutsu Kaisen Season 2' },
          nomineeName: 'Where Our Blue Is',
          details: 'Performed by Tatsuya Kitani',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen Season 2' }, nomineeName: 'Where Our Blue Is by Tatsuya Kitani', isWinner: true },
          { title: { english: 'Oshi no Ko' }, nomineeName: 'Idol by YOASOBI', isWinner: false },
          { title: { english: 'Chainsaw Man' }, nomineeName: 'Kick Back by Kenshi Yonezu', isWinner: false },
        ],
      },
      {
        name: 'Best Film',
        slug: 'best-film',
        description: 'Theatrical feature film excellence.',
        winner: {
          title: { english: 'Suzume', romaji: 'Suzume no Tojimari' },
          franchiseSlug: 'suzume',
          malId: 50594,
          details: 'CoMix Wave Films (Directed by Makoto Shinkai)',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Suzume' }, isWinner: true },
          { title: { english: 'Black Clover: Sword of the Wizard King' }, isWinner: false },
          { title: { english: 'One Piece Film: Red' }, isWinner: false },
          { title: { english: 'The First Slam Dunk' }, isWinner: false },
        ],
      },
    ],
  },
  {
    awardName: 'Crunchyroll Anime Awards',
    edition: '7th Annual Anime Awards (2023)',
    year: 2023,
    slug: 'crunchyroll-anime-awards-2023',
    status: 'completed' as const,
    ceremonyDate: 'March 4, 2023',
    location: 'Grand Prince Hotel New Takanawa, Tokyo, Japan',
    bannerImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    categories: [
      {
        name: 'Anime of the Year',
        slug: 'anime-of-the-year',
        description: 'The highest honor in anime.',
        winner: {
          title: { english: 'Cyberpunk: Edgerunners' },
          franchiseSlug: 'cyberpunk-edgerunners',
          malId: 42310,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1816/123494.jpg',
          details: 'Studio Trigger & CD PROJEKT RED',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Cyberpunk: Edgerunners' }, isWinner: true },
          { title: { english: 'Attack on Titan Final Season Part 2' }, isWinner: false },
          { title: { english: 'Demon Slayer: Kimetsu no Yaiba Entertainment District Arc' }, isWinner: false },
          { title: { english: 'Lycoris Recoil' }, isWinner: false },
          { title: { english: 'Ranking of Kings Cour 2' }, isWinner: false },
          { title: { english: 'SPY x FAMILY' }, isWinner: false },
        ],
      },
      {
        name: 'Best Animation',
        slug: 'best-animation',
        description: 'Visual fluidity and artistry.',
        winner: {
          title: { english: 'Demon Slayer: Kimetsu no Yaiba Entertainment District Arc' },
          franchiseSlug: 'demon-slayer-kimetsu-no-yaiba',
          malId: 47778,
          details: 'ufotable',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Demon Slayer: Kimetsu no Yaiba Entertainment District Arc' }, isWinner: true },
          { title: { english: 'Attack on Titan Final Season Part 2' }, isWinner: false },
          { title: { english: 'Cyberpunk: Edgerunners' }, isWinner: false },
          { title: { english: 'Ranking of Kings' }, isWinner: false },
        ],
      },
      {
        name: 'Best Action',
        slug: 'best-action',
        description: 'Unmatched intensity in battle sequences.',
        winner: {
          title: { english: 'Demon Slayer: Kimetsu no Yaiba Entertainment District Arc' },
          franchiseSlug: 'demon-slayer-kimetsu-no-yaiba',
          malId: 47778,
          details: 'ufotable',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Demon Slayer Entertainment District Arc' }, isWinner: true },
          { title: { english: 'Attack on Titan Final Season Part 2' }, isWinner: false },
          { title: { english: 'Cyberpunk: Edgerunners' }, isWinner: false },
        ],
      },
      {
        name: 'Best Opening Sequence',
        slug: 'best-opening-sequence',
        description: 'Best musical OP.',
        winner: {
          title: { english: 'Attack on Titan Final Season Part 2' },
          nomineeName: 'The Rumbling',
          details: 'Performed by SiM',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Attack on Titan Final Season Part 2' }, nomineeName: 'The Rumbling by SiM', isWinner: true },
          { title: { english: 'SPY x FAMILY' }, nomineeName: 'Mixed Nuts by Official HIGE DANDISM', isWinner: false },
          { title: { english: 'Demon Slayer Entertainment District Arc' }, nomineeName: 'Zankyosanka by Aimer', isWinner: false },
        ],
      },
      {
        name: 'Best Film',
        slug: 'best-film',
        description: 'Cinematic feature award.',
        winner: {
          title: { english: 'Jujutsu Kaisen 0' },
          franchiseSlug: 'jujutsu-kaisen',
          malId: 48561,
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen 0' }, isWinner: true },
          { title: { english: 'Dragon Ball Super: Super Hero' }, isWinner: false },
          { title: { english: 'Belle' }, isWinner: false },
          { title: { english: 'Inu-Oh' }, isWinner: false },
        ],
      },
    ],
  },
  {
    awardName: 'Crunchyroll Anime Awards',
    edition: '6th Annual Anime Awards (2022)',
    year: 2022,
    slug: 'crunchyroll-anime-awards-2022',
    status: 'completed' as const,
    ceremonyDate: 'February 9, 2022',
    location: 'Tokyo, Japan',
    bannerImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    categories: [
      {
        name: 'Anime of the Year',
        slug: 'anime-of-the-year',
        description: 'Top anime series of 2021/2022.',
        winner: {
          title: { english: 'Attack on Titan Final Season Part 1', romaji: 'Shingeki no Kyojin: The Final Season' },
          franchiseSlug: 'attack-on-titan',
          malId: 40028,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1000/110531.jpg',
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Attack on Titan Final Season Part 1' }, isWinner: true },
          { title: { english: '86 Eighty-Six' }, isWinner: false },
          { title: { english: 'Jujutsu Kaisen Cour 2' }, isWinner: false },
          { title: { english: 'ODD TAXI' }, isWinner: false },
          { title: { english: 'Ranking of Kings' }, isWinner: false },
          { title: { english: 'Sonny Boy' }, isWinner: false },
        ],
      },
      {
        name: 'Best Animation',
        slug: 'best-animation',
        description: 'Mastery in animation execution.',
        winner: {
          title: { english: 'Demon Slayer: Kimetsu no Yaiba Mugen Train Arc' },
          franchiseSlug: 'demon-slayer-kimetsu-no-yaiba',
          malId: 49926,
          details: 'ufotable',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Demon Slayer: Mugen Train Arc' }, isWinner: true },
          { title: { english: 'Jujutsu Kaisen' }, isWinner: false },
          { title: { english: 'Miss Kobayashi Dragon Maid S' }, isWinner: false },
          { title: { english: 'Mushoku Tensei' }, isWinner: false },
        ],
      },
      {
        name: 'Best Action',
        slug: 'best-action',
        description: 'Top action and combat direction.',
        winner: {
          title: { english: 'Jujutsu Kaisen', romaji: 'Jujutsu Kaisen' },
          franchiseSlug: 'jujutsu-kaisen',
          malId: 40748,
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen' }, isWinner: true },
          { title: { english: 'Attack on Titan Final Season Part 1' }, isWinner: false },
          { title: { english: 'Demon Slayer Mugen Train Arc' }, isWinner: false },
        ],
      },
      {
        name: 'Best Opening Sequence',
        slug: 'best-opening-sequence',
        description: 'Leading OP composition.',
        winner: {
          title: { english: 'Attack on Titan Final Season Part 1' },
          nomineeName: 'Boku no Sensou (My War)',
          details: 'Performed by Shinsei Kamattechan',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Attack on Titan Final Season Part 1' }, nomineeName: 'Boku no Sensou by Shinsei Kamattechan', isWinner: true },
          { title: { english: 'BEASTARS Season 2' }, nomineeName: 'Kaibutsu by YOASOBI', isWinner: false },
          { title: { english: 'Jujutsu Kaisen' }, nomineeName: 'Vivid Vice by Who-ya Extended', isWinner: false },
        ],
      },
      {
        name: 'Best Film',
        slug: 'best-film',
        description: 'Theatrical box office and critical masterwork.',
        winner: {
          title: { english: 'Demon Slayer: Kimetsu no Yaiba the Movie: Mugen Train' },
          franchiseSlug: 'demon-slayer-kimetsu-no-yaiba',
          malId: 40456,
          details: 'ufotable',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Demon Slayer the Movie: Mugen Train' }, isWinner: true },
          { title: { english: 'Belle' }, isWinner: false },
          { title: { english: 'Evangelion: 3.0+1.0 Thrice Upon a Time' }, isWinner: false },
          { title: { english: 'Josee, the Tiger and the Fish' }, isWinner: false },
        ],
      },
    ],
  },
  {
    awardName: 'Crunchyroll Anime Awards',
    edition: '5th Annual Anime Awards (2021)',
    year: 2021,
    slug: 'crunchyroll-anime-awards-2021',
    status: 'completed' as const,
    ceremonyDate: 'February 19, 2021',
    location: 'Tokyo, Japan',
    bannerImage: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80',
    categories: [
      {
        name: 'Anime of the Year',
        slug: 'anime-of-the-year',
        description: 'Premier title of the 2020/2021 era.',
        winner: {
          title: { english: 'Jujutsu Kaisen', romaji: 'Jujutsu Kaisen' },
          franchiseSlug: 'jujutsu-kaisen',
          malId: 40748,
          imageUrl: 'https://cdn.myanimelist.net/images/anime/1171/109222.jpg',
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen' }, isWinner: true },
          { title: { english: 'Keep Your Hands Off Eizouken!' }, isWinner: false },
          { title: { english: 'Dorohedoro' }, isWinner: false },
          { title: { english: 'Great Pretender' }, isWinner: false },
          { title: { english: 'BEASTARS' }, isWinner: false },
          { title: { english: 'Appare-Ranman!' }, isWinner: false },
        ],
      },
      {
        name: 'Best Animation',
        slug: 'best-animation',
        description: 'Boundary-pushing visual expression.',
        winner: {
          title: { english: 'Keep Your Hands Off Eizouken!' },
          franchiseSlug: 'keep-your-hands-off-eizouken',
          malId: 39792,
          details: 'Science SARU (Directed by Masaaki Yuasa)',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Keep Your Hands Off Eizouken!' }, isWinner: true },
          { title: { english: 'God of High School' }, isWinner: false },
          { title: { english: 'Great Pretender' }, isWinner: false },
          { title: { english: 'Jujutsu Kaisen' }, isWinner: false },
        ],
      },
      {
        name: 'Best Action',
        slug: 'best-action',
        description: 'Superior action execution.',
        winner: {
          title: { english: 'Jujutsu Kaisen' },
          franchiseSlug: 'jujutsu-kaisen',
          malId: 40748,
          details: 'MAPPA',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Jujutsu Kaisen' }, isWinner: true },
          { title: { english: 'Deca-Dence' }, isWinner: false },
          { title: { english: 'The God of High School' }, isWinner: false },
          { title: { english: 'Dorohedoro' }, isWinner: false },
        ],
      },
      {
        name: 'Best Opening Sequence',
        slug: 'best-opening-sequence',
        description: 'Exemplary opening performance.',
        winner: {
          title: { english: 'BEASTARS' },
          nomineeName: 'Wild Side',
          details: 'Performed by ALI',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'BEASTARS' }, nomineeName: 'Wild Side by ALI', isWinner: true },
          { title: { english: 'Jujutsu Kaisen' }, nomineeName: 'Kaikai Kitan by Eve', isWinner: false },
          { title: { english: 'Keep Your Hands Off Eizouken!' }, nomineeName: 'Easy Breezy by chelmico', isWinner: false },
        ],
      },
      {
        name: 'Best Film',
        slug: 'best-film',
        description: 'Best animated feature release.',
        winner: {
          title: { english: 'Made in Abyss: Dawn of the Deep Soul' },
          franchiseSlug: 'made-in-abyss',
          malId: 36862,
          details: 'Kinema Citrus',
          isWinner: true,
        },
        nominees: [
          { title: { english: 'Made in Abyss: Dawn of the Deep Soul' }, isWinner: true },
          { title: { english: 'A Whisker Away' }, isWinner: false },
          { title: { english: 'Fate/stay night: Heaven’s Feel III. spring song' }, isWinner: false },
        ],
      },
    ],
  },
];

async function seedAwards() {
  console.log('🏆 Starting Anime Awards Seeder (Active Year + Past 5 Years Rolling Window)...');
  await connectDatabase();

  for (const award of AWARDS_DATA) {
    const doc = await awardService.upsertAward(award);
    console.log(`   ✅ Seeded: ${doc.edition} (${doc.year}) - ${doc.categories.length} categories`);
  }

  // Verification of Rolling Prune Logic:
  // Let's deliberately test what happens if an outdated award year (e.g. 2019) exists:
  console.log('\n🧪 Testing Rolling Prune Validation: Inserting dummy outdated 2019 test record...');
  await Award.create({
    awardName: 'Crunchyroll Anime Awards',
    edition: '3rd Annual Anime Awards (2019)',
    year: 2019,
    slug: 'crunchyroll-anime-awards-2019-test',
    status: 'completed',
    totalCategories: 1,
    categories: [
      {
        name: 'Anime of the Year',
        slug: 'anime-of-the-year',
        winner: {
          title: { english: 'My Hero Academia Season 3' },
          isWinner: true,
        },
        nominees: [],
      },
    ],
  });

  console.log('   Dummy 2019 inserted. Now running awardService.pruneOutdatedAwards()...');
  const pruneResult = await awardService.pruneOutdatedAwards();
  console.log(`   Pruning Result: Deleted ${pruneResult.deletedCount} outdated records!`);
  console.log(`   Active Retained Years:`, pruneResult.window.retainedYears);
  console.log(`   Policy: ${pruneResult.window.retentionPolicy}`);

  const remaining = await Award.find().select('year edition').sort({ year: -1 });
  console.log('\n📊 Final Awards Currently in Database:');
  remaining.forEach((r) => console.log(`   - ${r.year}: ${r.edition}`));

  console.log('\n🎉 Anime Awards Seeding and Rolling Purge Verification Completed Successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

seedAwards().catch(async (err) => {
  console.error('Fatal Award Seeding Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
