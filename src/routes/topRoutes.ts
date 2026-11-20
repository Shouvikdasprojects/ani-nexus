import { Router, Request, Response } from 'express';
import { Franchise } from '../models/Franchise.js';

export const topRouter = Router();

/**
 * GET /api/v1/top
 * Curated Top Collections for Frontend Carousels & UI Grids
 * Query param: ?type=trending | popular | rated | movies | airing | upcoming
 */
topRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const type = String(req.query.type || 'popular').toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    let mongoQuery: any = {};
    let sortObj: any = { 'timeline.0.scores.combinedAverage': -1 };

    switch (type) {
      case 'trending':
        // Trending: Recent popularity and high ratings on primary franchise entry
        sortObj = { 'timeline.0.scores.anilist.popularity': -1, 'timeline.0.year': -1 };
        break;

      case 'rated':
        // Anime Awards & All-Time Highest Rated (MAL & AniList combined)
        mongoQuery['timeline.0.scores.combinedAverage'] = { $gt: 0 };
        sortObj = { 'timeline.0.scores.combinedAverage': -1 };
        break;

      case 'movies':
        // Top Anime Movies
        mongoQuery['timeline.format'] = new RegExp('^movie$', 'i');
        sortObj = { 'timeline.0.scores.combinedAverage': -1 };
        break;

      case 'airing':
        // Currently Airing Seasons
        mongoQuery['timeline.status'] = new RegExp('^releasing$', 'i');
        sortObj = { 'timeline.0.year': -1, 'timeline.0.scores.combinedAverage': -1 };
        break;

      case 'upcoming':
        // Most Anticipated Upcoming
        const currentYear = new Date().getUTCFullYear();
        mongoQuery['$or'] = [
          { 'timeline.status': new RegExp('^not_yet_released$', 'i') },
          { 'timeline.year': { $gte: currentYear } },
        ];
        sortObj = { 'timeline.0.year': 1, 'timeline.0.scores.combinedAverage': -1 };
        break;

      case 'popular':
      default:
        // All-Time Most Popular: filter for rank > 0 to prevent nulls sorting first in ascending order
        mongoQuery['timeline.0.scores.mal.popularity'] = { $gt: 0 };
        sortObj = { 'timeline.0.scores.mal.popularity': 1, 'timeline.0.scores.combinedAverage': -1 };
        break;
    }

    const [total, results] = await Promise.all([
      Franchise.countDocuments(mongoQuery),
      Franchise.find(mongoQuery, {
        titles: 1,
        slug: 1,
        images: 1,
        classification: 1,
        contentRating: 1,
        'timeline.scores': 1,
        'timeline.languages': 1,
        'timeline.year': 1,
        'timeline.format': 1,
        'timeline.status': 1,
        'timeline.trailer': 1,
        totalEpisodes: 1,
        totalParts: 1,
      })
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        collectionType: type,
        total,
        page,
        count: results.length,
        franchises: results,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
