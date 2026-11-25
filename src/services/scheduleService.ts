import { anilistService } from './anilistService.js';
import { getScheduleSnapshotModel } from '../config/database.js';

export interface WeeklySchedulePayload {
  totalAiringThisWeek: number;
  calendar: Record<string, any[]>;
}

/**
 * Fetches live 7-day airing schedule from AniList, normalizes day buckets,
 * and persists the snapshot into Vault 3 (Real-Time Hub).
 */
export async function fetchAndPersistWeeklySchedule(): Promise<{
  payload: WeeklySchedulePayload;
  rawSchedules: any[];
}> {
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60;

  const schedules = await anilistService.getAiringSchedule(now, sevenDaysFromNow);

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

    const totalSec = Math.max(0, item.timeUntilAiring);
    const daysLeft = Math.floor(totalSec / 86400);
    const hoursLeft = Math.floor((totalSec % 86400) / 3600);
    const minsLeft = Math.floor((totalSec % 3600) / 60);
    const countdownFormatted =
      daysLeft > 0
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

  const payload: WeeklySchedulePayload = {
    totalAiringThisWeek: schedules.length,
    calendar,
  };

  if (schedules.length > 0) {
    try {
      await getScheduleSnapshotModel().findOneAndUpdate(
        { snapshotId: 'weekly_calendar' },
        {
          snapshotId: 'weekly_calendar',
          data: payload,
          totalAiringThisWeek: schedules.length,
          cachedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err: any) {
      console.warn('[Vault 3 Schedule Snapshot Warning]:', err.message);
    }
  }

  return { payload, rawSchedules: schedules };
}
