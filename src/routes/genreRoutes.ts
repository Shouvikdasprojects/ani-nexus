import { Router, Request, Response } from 'express';
import { Genre } from '../models/Genre.js';
import { getAllFranchiseModels } from '../config/database.js';
import { escapeRegex, findMergedAcrossVaults } from '../utils/vaultQuery.js';

export const genreRouter = Router();
export const filterRouter = Router();

// Master Catalog of 50+ Genres, Themes, Demographics, and Adult classifications
export const DEFAULT_GENRE_CATALOG = [
  // 1. Core Action & Adventure
  { name: 'Action', slug: 'action', type: 'genre', icon: '⚔️', description: 'Fast-paced, physical challenges and combat.' },
  { name: 'Adventure', slug: 'adventure', type: 'genre', icon: '🗺️', description: 'Journeys, explorations, and epic quests.' },
  { name: 'Fantasy', slug: 'fantasy', type: 'genre', icon: '🧙‍♂️', description: 'Magic, mythical creatures, and wondrous realms.' },
  { name: 'Sci-Fi', slug: 'sci-fi', type: 'genre', icon: '🚀', description: 'Futuristic science, space travel, and technology.' },
  { name: 'Supernatural', slug: 'supernatural', type: 'genre', icon: '👻', description: 'Ghosts, spirits, and paranormal phenomena.' },
  { name: 'Mystery', slug: 'mystery', type: 'genre', icon: '🔍', description: 'Puzzles, detective work, and secret uncovering.' },

  // 2. Emotion & Slice of Life
  { name: 'Comedy', slug: 'comedy', type: 'genre', icon: '😂', description: 'Humorous, amusing, and lighthearted stories.' },
  { name: 'Drama', slug: 'drama', type: 'genre', icon: '🎭', description: 'Emotional conflicts and human relationships.' },
  { name: 'Romance', slug: 'romance', type: 'genre', icon: '💖', description: 'Love, affection, and romantic bonds.' },
  { name: 'Slice of Life', slug: 'slice-of-life', type: 'genre', icon: '🍵', description: 'Everyday mundane realities and heartwarming moments.' },
  { name: 'Sports', slug: 'sports', type: 'genre', icon: '⚽', description: 'Athletic competitions, teamwork, and passion.' },
  { name: 'Music', slug: 'music', type: 'genre', icon: '🎵', description: 'Singing, musical instruments, and idol bands.' },

  // 3. Thrills & Psychology
  { name: 'Horror', slug: 'horror', type: 'genre', icon: '🧟', description: 'Dread, fear, and terrifying encounters.' },
  { name: 'Psychological', slug: 'psychological', type: 'genre', icon: '🧠', description: 'Mind games, mental battles, and deeper motives.' },
  { name: 'Suspense', slug: 'suspense', type: 'genre', icon: '⏱️', description: 'High-tension situations and cliffhangers.' },

  // 4. Themes
  { name: 'Isekai', slug: 'isekai', type: 'theme', icon: '🌀', description: 'Transported or reincarnated into another universe.' },
  { name: 'Mecha', slug: 'mecha', type: 'theme', icon: '🤖', description: 'Giant pilotable robots and cybernetic wars.' },
  { name: 'Time Travel', slug: 'time-travel', type: 'theme', icon: '⏳', description: 'Moving across different timelines and temporal loops.' },
  { name: 'School', slug: 'school', type: 'theme', icon: '🏫', description: 'Campus life, clubs, and student relationships.' },
  { name: 'Historical', slug: 'historical', type: 'theme', icon: '🏯', description: 'Feudal eras, samurai periods, or real-world history.' },
  { name: 'Military', slug: 'military', type: 'theme', icon: '🎖️', description: 'Warfare, army tactics, and geopolitical conflict.' },
  { name: 'Martial Arts', slug: 'martial-arts', type: 'theme', icon: '🥋', description: 'Hand-to-hand combat styles, dojos, and martial philosophy.' },
  { name: 'Mythology', slug: 'mythology', type: 'theme', icon: '⚡', description: 'Gods, folklore, and ancient legends.' },
  { name: 'Parody', slug: 'parody', type: 'theme', icon: '🃏', description: 'Satirical spoofs and comical meta-commentary.' },
  { name: 'Space', slug: 'space', type: 'theme', icon: '🌌', description: 'Interstellar voyages and planetary systems.' },
  { name: 'Cyberpunk', slug: 'cyberpunk', type: 'theme', icon: '🏙️', description: 'High tech, low life dystopian neon futures.' },
  { name: 'Post-Apocalyptic', slug: 'post-apocalyptic', type: 'theme', icon: '🌋', description: 'Surviving in the ruins of civilization.' },

  // 5. Demographics
  { name: 'Shounen', slug: 'shounen', type: 'demographic', icon: '🔥', description: 'Aimed primarily at young male audiences.' },
  { name: 'Seinen', slug: 'seinen', type: 'demographic', icon: '🍷', description: 'Aimed primarily at mature adult male audiences.' },
  { name: 'Shoujo', slug: 'shoujo', type: 'demographic', icon: '🌸', description: 'Aimed primarily at young female audiences.' },
  { name: 'Josei', slug: 'josei', type: 'demographic', icon: '👠', description: 'Aimed primarily at mature adult female audiences.' },
  { name: 'Kids', slug: 'kids', type: 'demographic', icon: '🧸', description: 'Aimed at young children and families.' },

  // 6. Adult & 18+ Classification
  { name: 'Ecchi', slug: 'ecchi', type: 'adult', icon: '🔞', description: 'Playful fanservice and mild adult comedy.' },
  { name: 'Hentai', slug: 'hentai', type: 'adult', icon: '🚫', description: 'Explicit adult entertainment (Strictly 18+).' },
];

/**
 * Shared Multi-Criteria Filter Logic
 */
export async function handleAnimeFilter(req: Request, res: Response): Promise<void> {
  try {
    const { genre, theme, demographic, year, format, dub, isAdult, sort } = req.query;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const mongoQuery: any = {};

    if (genre) {
      mongoQuery['classification.genres.slug'] = String(genre).toLowerCase();
    }
    if (theme) {
      mongoQuery['classification.themes.slug'] = String(theme).toLowerCase();
    }
    if (demographic) {
      mongoQuery['classification.demographic.slug'] = String(demographic).toLowerCase();
    }
    if (year) {
      mongoQuery['timeline.year'] = Number(year);
    }
    if (format) {
      mongoQuery['timeline.format'] = String(format).toUpperCase();
    }
    if (dub) {
      mongoQuery['timeline.languages.audioDubs'] = new RegExp(`^${escapeRegex(String(dub))}$`, 'i');
    }
    const isAdultMode = String(isAdult ?? 'false').toLowerCase();
    if (isAdultMode === 'true') {
      mongoQuery['contentRating.isAdult'] = true;
    } else if (isAdultMode !== 'all') {
      mongoQuery['contentRating.isAdult'] = { $ne: true };
    }

    let sortObj: any = { 'timeline.0.scores.combinedAverage': -1 };
    if (sort === 'popularity') {
      sortObj = { 'timeline.0.scores.mal.popularity': 1 };
    } else if (sort === 'newest') {
      sortObj = { 'timeline.year': -1 };
    }

    const { total, results } = await findMergedAcrossVaults(getAllFranchiseModels(), {
      filter: mongoQuery,
      projection: {
        titles: 1,
        slug: 1,
        images: 1,
        classification: 1,
        contentRating: 1,
        'timeline.scores': 1,
        'timeline.languages': 1,
        'timeline.year': 1,
        totalEpisodes: 1,
      },
      sort: sortObj,
      skip,
      limit,
      dedupeKey: 'slug',
    });

    res.json({
      success: true,
      data: {
        total,
        page,
        results,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/v1/genres
 * Returns all 50+ available genres, themes, and demographics
 */
genreRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    let dbGenres = await Genre.find().sort({ type: 1, name: 1 }).lean();

    // Auto-seed default catalog if collection is empty
    if (dbGenres.length === 0) {
      await Genre.insertMany(DEFAULT_GENRE_CATALOG);
      dbGenres = await Genre.find().sort({ type: 1, name: 1 }).lean();
    }

    res.json({
      success: true,
      data: {
        total: dbGenres.length,
        genres: dbGenres,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount filter handlers
genreRouter.get('/filter', handleAnimeFilter);
filterRouter.get('/', handleAnimeFilter);

/**
 * GET /api/v1/genres/:slug
 * Retrieve franchises belonging to a specific genre across Vault 1 & Vault 1B
 */
genreRouter.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { 'classification.genres.slug': slug },
        { 'classification.themes.slug': slug },
        { 'classification.demographic.slug': slug },
      ],
    };

    const { total, results: franchises } = await findMergedAcrossVaults(getAllFranchiseModels(), {
      filter: query,
      projection: {
        titles: 1,
        slug: 1,
        images: 1,
        classification: 1,
        totalEpisodes: 1,
        'timeline.scores': 1,
      },
      sort: { 'timeline.0.scores.combinedAverage': -1 },
      skip,
      limit,
      dedupeKey: 'slug',
    });

    res.json({
      success: true,
      data: {
        genreSlug: slug,
        total,
        page,
        franchises,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
