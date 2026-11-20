import { Router, Request, Response } from 'express';
import { Franchise } from '../models/Franchise.js';
import { anilistService } from '../services/anilistService.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';

export const seasonRouter = Router();

type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

/**
 * Determines current season based on month
 */
function getCurrentSeasonDetails(): { season: AnimeSeason; year: number } {
  const now = new Date();
  const month = now.getUTCMonth() + 1; // 1-12
  const year = now.getUTCFullYear();

  let season: AnimeSeason = 'FALL';
  if (month >= 1 && month <= 3) season = 'WINTER';
  else if (month >= 4 && month <= 6) season = 'SPRING';
  else if (month >= 7 && month <= 9) season = 'SUMMER';
  else season = 'FALL';

  return { season, year };
}

/**
 * GET /api/v1/seasons/now
 * Currently airing anime for the active season
 */
seasonRouter.get('/now', async (req: Request, res: Response): Promise<void> => {
  try {
    const { season, year } = getCurrentSeasonDetails();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // 1. Check local MongoDB Atlas with precise array element matching
    const query = {
      timeline: {
        $elemMatch: {
          year,
          status: { $in: ['RELEASING', 'FINISHED'] },
        },
      },
    };

    let [total, results] = await Promise.all([
      Franchise.countDocuments(query),
      Franchise.find(query, {
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
        totalEpisodes: 1,
      })
        .sort({ 'timeline.0.scores.combinedAverage': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // 2. Non-blocking asynchronous background ingestion if few entries in database
    if (total < 5) {
      setImmediate(async () => {
        try {
          const gqlQuery = `
            query ($year: Int, $season: MediaSeason, $perPage: Int) {
              Page(page: 1, perPage: $perPage) {
                media(season: $season, seasonYear: $year, type: ANIME, sort: [POPULARITY_DESC]) {
                  id
                  idMal
                }
              }
            }
          `;

          const aniRes = await (anilistService as any).fetchGraphQL(gqlQuery, {
            year,
            season,
            perPage: 6,
          });

          const list = aniRes?.Page?.media || [];
          for (const item of list) {
            if (item.idMal) {
              const alreadyExists = await Franchise.exists({ 'timeline.ids.malId': item.idMal });
              if (!alreadyExists) {
                await franchiseBuilder.buildFromMalId(item.idMal);
              }
            }
          }
        } catch (err: any) {
          console.warn('[Seasons Now Background Ingestion]:', err.message);
        }
      });
    }

    res.json({
      success: true,
      data: {
        season,
        year,
        total,
        page,
        franchises: results,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/seasons/upcoming
 * Anticipated anime scheduled for future release
 */
seasonRouter.get('/upcoming', async (req: Request, res: Response): Promise<void> => {
  try {
    const { year } = getCurrentSeasonDetails();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { 'timeline.status': 'NOT_YET_RELEASED' },
        { 'timeline.year': { $gte: year } },
      ],
    };

    const [total, results] = await Promise.all([
      Franchise.countDocuments(query),
      Franchise.find(query, {
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
      })
        .sort({ 'timeline.year': 1, 'timeline.0.scores.combinedAverage': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        type: 'upcoming',
        total,
        page,
        franchises: results,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/seasons/:year/:season
 * Archive for specific season (e.g. /api/v1/seasons/2024/fall)
 */
seasonRouter.get('/:year/:season', async (req: Request, res: Response): Promise<void> => {
  try {
    const year = Number(req.params.year);
    const seasonInput = String(req.params.season).toUpperCase() as AnimeSeason;
    const validSeasons: AnimeSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];

    if (!validSeasons.includes(seasonInput)) {
      res.status(400).json({
        success: false,
        error: `Invalid season '${req.params.season}'. Allowed values: winter, spring, summer, fall`,
      });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const query = {
      timeline: {
        $elemMatch: {
          year,
        },
      },
    };

    const [total, results] = await Promise.all([
      Franchise.countDocuments(query),
      Franchise.find(query, {
        titles: 1,
        slug: 1,
        images: 1,
        classification: 1,
        contentRating: 1,
        'timeline.scores': 1,
        'timeline.languages': 1,
        'timeline.year': 1,
        'timeline.format': 1,
        totalEpisodes: 1,
      })
        .sort({ 'timeline.0.scores.combinedAverage': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        season: seasonInput,
        year,
        total,
        page,
        franchises: results,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
