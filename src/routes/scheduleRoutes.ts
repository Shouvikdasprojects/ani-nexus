import { Router, Request, Response } from 'express';
import { anilistService } from '../services/anilistService.js';
import { getScheduleSnapshotModel } from '../config/database.js';

export const scheduleRouter = Router();

// In-memory cache for high-speed delivery and rate-limit immunity
let cachedScheduleData: any = null;
let lastScheduleFetchTime = 0;
const SCHEDULE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * GET /api/v1/schedule
 * 7-Day Live Broadcast Calendar with Episode countdown
 */
scheduleRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const forceLive = req.query.live === 'true';

    // 1. Check in-memory RAM cache first (0ms latency)
    if (!forceLive && cachedScheduleData && (Date.now() - lastScheduleFetchTime < SCHEDULE_CACHE_TTL)) {
      res.json({
        success: true,
        source: 'cache',
        data: cachedScheduleData,
      });
      return;
    }

    // 2. Cold-boot check: check Vault 3 (Real-Time Hub) if RAM cache is cold
    if (!forceLive && !cachedScheduleData) {
      try {
        const snapshot = await getScheduleSnapshotModel().findOne({ snapshotId: 'weekly_calendar' }).lean();
        if (snapshot?.data && (Date.now() - new Date(snapshot.cachedAt).getTime() < 60 * 60 * 1000)) {
          cachedScheduleData = snapshot.data;
          lastScheduleFetchTime = new Date(snapshot.cachedAt).getTime();
          res.json({
            success: true,
            source: 'vault3-snapshot',
            data: cachedScheduleData,
          });
          return;
        }
      } catch (err: any) {
        console.warn('[Schedule Snapshot Query Warning]:', err.message);
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60;

    const schedules = await anilistService.getAiringSchedule(now, sevenDaysFromNow);

    if ((!schedules || schedules.length === 0) && cachedScheduleData) {
      res.json({
        success: true,
        source: 'stale-cache',
        data: cachedScheduleData,
      });
      return;
    }

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
      const mainStudio = media?.studios?.nodes?.[0]?.name || null;

      // Format time countdown nicely (e.g. "3d 4h", "5h 22m", "45m")
      const totalSec = Math.max(0, item.timeUntilAiring);
      const daysLeft = Math.floor(totalSec / 86400);
      const hoursLeft = Math.floor((totalSec % 86400) / 3600);
      const minsLeft = Math.floor((totalSec % 3600) / 60);
      const countdownFormatted = daysLeft > 0
        ? `${daysLeft}d ${hoursLeft}h`
        : hoursLeft > 0
        ? `${hoursLeft}h ${minsLeft}m`
        : `${minsLeft}m`;

      const entry = {
        airingId: item.id,
        airingAt: new Date(item.airingAt * 1000).toISOString(),
        timeUntilAiringSeconds: item.timeUntilAiring,
        countdown: countdownFormatted,
        episodeNumber: item.episode,
        totalEpisodes: media?.episodes || null,
        studio: mainStudio,
        anime: {
          malId: media?.idMal || null,
          aniId: media?.id || null,
          title: {
            primary: primaryTitle,
            english: media?.title?.english || null,
            romaji: media?.title?.romaji || null,
            native: media?.title?.native || null,
          },
          coverImage: media?.coverImage?.large || media?.coverImage?.extraLarge || null,
          bannerImage: media?.bannerImage || null,
          format: media?.format || 'TV',
          status: media?.status || 'RELEASING',
          countryOfOrigin: media?.countryOfOrigin || 'JP',
          score: media?.averageScore || null,
          popularity: media?.popularity || null,
          genres: media?.genres || [],
          description: media?.description || null,
          studios: media?.studios?.nodes || [],
          externalLinks: media?.externalLinks || [],
        },
      };

      if (calendar[dayName]) {
        calendar[dayName].push(entry);
      }
    });

    const schedulePayload = {
      totalAiringThisWeek: schedules.length,
      calendar,
    };

    if (schedules.length > 0) {
      cachedScheduleData = schedulePayload;
      lastScheduleFetchTime = Date.now();

      // Persist snapshot to Vault 3 (Real-Time Hub) asynchronously
      try {
        getScheduleSnapshotModel().findOneAndUpdate(
          { snapshotId: 'weekly_calendar' },
          {
            snapshotId: 'weekly_calendar',
            data: schedulePayload,
            totalAiringThisWeek: schedules.length,
            cachedAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).catch((err: any) => console.warn('[Vault 3 Schedule Snapshot Warning]:', err.message));
      } catch (err: any) {
        console.warn('[Vault 3 Schedule Snapshot Warning]:', err.message);
      }
    }

    res.json({
      success: true,
      data: schedulePayload,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
