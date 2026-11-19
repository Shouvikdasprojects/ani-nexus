import { Router, Request, Response } from 'express';
import { anilistService } from '../services/anilistService.js';

export const scheduleRouter = Router();

/**
 * GET /api/v1/schedule
 * 7-Day Live Broadcast Calendar with Episode countdown
 */
scheduleRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60;

    const schedules = await anilistService.getAiringSchedule(now, sevenDaysFromNow);

    // Group airing episodes by day of week
    const calendar: Record<string, any[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    schedules.forEach((item: any) => {
      const airDate = new Date(item.airingAt * 1000);
      const dayName = days[airDate.getUTCDay()];

      const media = item.media;
      const primaryTitle = media?.title?.english || media?.title?.romaji || 'Unknown Title';

      const entry = {
        airingId: item.id,
        airingAt: new Date(item.airingAt * 1000).toISOString(),
        timeUntilAiringSeconds: item.timeUntilAiring,
        episodeNumber: item.episode,
        anime: {
          malId: media?.idMal || null,
          aniId: media?.id || null,
          title: {
            primary: primaryTitle,
            english: media?.title?.english || null,
            romaji: media?.title?.romaji || null,
            native: media?.title?.native || null,
          },
          coverImage: media?.coverImage?.large || null,
          bannerImage: media?.bannerImage || null,
          format: media?.format || 'TV',
          score: media?.averageScore || null,
          genres: media?.genres || [],
        },
      };

      if (calendar[dayName]) {
        calendar[dayName].push(entry);
      }
    });

    res.json({
      success: true,
      data: {
        totalAiringThisWeek: schedules.length,
        calendar,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
