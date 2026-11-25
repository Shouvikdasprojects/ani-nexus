import { Router, Request, Response } from 'express';
import { getAllFranchiseModels } from '../config/database.js';
import { existsAcrossVaults, findMergedAcrossVaults } from '../utils/vaultQuery.js';
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
 * Currently airing anime for the active season across Vault 1 & Vault 1B
 */
seasonRouter.get('/now', async (req: Request, res: Response): Promise<void> => {
  try {
    const { season, year } = getCurrentSeasonDetails();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    // 1. Check local MongoDB Atlas across Vault 1 + Vault 1B
    const query = {
      timeline: {
        $elemMatch: {
          year,
          status: { $in: ['RELEASING', 'FINISHED'] },
        },
      },
    };

    const franchiseModels = getAllFranchiseModels();
    const { total, results } = await findMergedAcrossVaults(franchiseModels, {
      filter: query,
      projection: {
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
      },
      sort: { 'timeline.0.scores.combinedAverage': -1 },
      skip,
      limit,
      dedupeKey: 'slug',
    });

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
              const alreadyExists = await existsAcrossVaults(franchiseModels, { 'timeline.ids.malId': item.idMal });
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

    const { total, results } = await findMergedAcrossVaults(getAllFranchiseModels(), {
      filter: query,
      projection: {
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
      },
      sort: { 'timeline.year': 1, 'timeline.0.scores.combinedAverage': -1 },
      skip,
      limit,
      dedupeKey: 'slug',
    });

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
 * Archive for specific season with full AniChart parity (e.g. /api/v1/seasons/2026/fall)
 * Supports query params: ?format=TV|MOVIE|OVA|ONA|SPECIAL&page=1&limit=50&live=true
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

    const limit = Math.min(Number(req.query.limit) || 25, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const formatFilter = req.query.format ? String(req.query.format).toUpperCase() : undefined;
    const forceLive = req.query.live === 'true';

    // 1. Check local MongoDB Atlas across Vault 1 & Vault 1B
    const query: Record<string, any> = {
      'timeline.year': year,
    };
    if (formatFilter) {
      query['timeline.format'] = formatFilter;
    }

    const franchiseModels = getAllFranchiseModels();
    const { total: dbTotal, results: dbResults } = await findMergedAcrossVaults(franchiseModels, {
      filter: query,
      projection: {
        titles: 1,
        slug: 1,
        images: 1,
        classification: 1,
        contentRating: 1,
        studios: 1,
        'timeline.scores': 1,
        'timeline.languages': 1,
        'timeline.year': 1,
        'timeline.format': 1,
        'timeline.status': 1,
        'timeline.trailer': 1,
        totalEpisodes: 1,
      },
      sort: { 'timeline.0.scores.combinedAverage': -1 },
      skip: (page - 1) * limit,
      limit,
      dedupeKey: 'slug',
    });

    // 2. If DB has sufficient data and live not forced, return cached MongoDB data
    if (dbTotal >= 5 && !forceLive) {
      res.json({
        success: true,
        source: 'database',
        data: {
          season: seasonInput,
          year,
          format: formatFilter || 'ALL',
          total: dbTotal,
          page,
          franchises: dbResults,
        },
      });
      return;
    }

    // 3. Fallback to Live AniChart Engine: Full seasonal releases with studios & countdowns
    const liveData = await anilistService.getSeasonalAnime(year, seasonInput, page, limit, formatFilter);

    // Format items to match AniChart specifications
    const formattedAnime = liveData.media.map((m: any) => {
      const primaryTitle = m.title?.english || m.title?.romaji || 'Unknown Title';
      const mainStudio = m.studios?.nodes?.[0]?.name || null;

      let countdown: string | null = null;
      if (m.nextAiringEpisode?.timeUntilAiring) {
        const totalSec = Math.max(0, m.nextAiringEpisode.timeUntilAiring);
        const daysLeft = Math.floor(totalSec / 86400);
        const hoursLeft = Math.floor((totalSec % 86400) / 3600);
        const minsLeft = Math.floor((totalSec % 3600) / 60);
        countdown = daysLeft > 0
          ? `${daysLeft}d ${hoursLeft}h`
          : hoursLeft > 0
          ? `${hoursLeft}h ${minsLeft}m`
          : `${minsLeft}m`;
      }

      return {
        id: m.id,
        malId: m.idMal || null,
        title: {
          primary: primaryTitle,
          english: m.title?.english || null,
          romaji: m.title?.romaji || null,
          native: m.title?.native || null,
        },
        format: m.format,
        status: m.status,
        episodes: m.episodes || null,
        durationMinutes: m.duration || null,
        countryOfOrigin: m.countryOfOrigin || 'JP',
        source: m.source || 'Original',
        studio: mainStudio,
        studios: m.studios?.nodes || [],
        score: m.averageScore || null,
        popularity: m.popularity || null,
        favourites: m.favourites || 0,
        genres: m.genres || [],
        description: m.description || null,
        startDate: m.startDate || null,
        coverImage: m.coverImage?.extraLarge || m.coverImage?.large || null,
        bannerImage: m.bannerImage || null,
        nextAiringEpisode: m.nextAiringEpisode
          ? {
              episode: m.nextAiringEpisode.episode,
              airingAt: new Date(m.nextAiringEpisode.airingAt * 1000).toISOString(),
              timeUntilAiringSeconds: m.nextAiringEpisode.timeUntilAiring,
              countdown,
            }
          : null,
        trailer: m.trailer?.id ? {
          id: m.trailer.id,
          site: m.trailer.site,
          url: `https://www.youtube.com/watch?v=${m.trailer.id}`,
          thumbnail: m.trailer.thumbnail,
        } : null,
        externalLinks: m.externalLinks || [],
      };
    });

    // Asynchronously ingest top items into MongoDB Atlas in background
    setImmediate(async () => {
      try {
        const topToIngest = liveData.media.slice(0, 3);
        for (const item of topToIngest) {
          if (item.idMal) {
            const exists = await existsAcrossVaults(franchiseModels, { 'timeline.ids.malId': item.idMal });
            if (!exists) {
              await franchiseBuilder.buildFromMalId(item.idMal);
            }
          }
        }
      } catch (err: any) {
        console.warn('[Seasonal On-Demand Ingestion Warning]:', err.message);
      }
    });

    res.json({
      success: true,
      source: 'live_engine',
      data: {
        season: seasonInput,
        year,
        format: formatFilter || 'ALL',
        total: liveData.total,
        page: liveData.page,
        hasNextPage: liveData.hasNextPage,
        count: formattedAnime.length,
        anime: formattedAnime,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
