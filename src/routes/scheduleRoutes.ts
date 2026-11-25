import { Router, Request, Response } from 'express';
import { getScheduleSnapshotModel } from '../config/database.js';
import { fetchAndPersistWeeklySchedule } from '../services/scheduleService.js';

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
    if (!forceLive && cachedScheduleData && Date.now() - lastScheduleFetchTime < SCHEDULE_CACHE_TTL) {
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
        if (snapshot?.data && Date.now() - new Date(snapshot.cachedAt).getTime() < 60 * 60 * 1000) {
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

    const { payload, rawSchedules } = await fetchAndPersistWeeklySchedule();

    if ((!rawSchedules || rawSchedules.length === 0) && cachedScheduleData) {
      res.json({
        success: true,
        source: 'stale-cache',
        data: cachedScheduleData,
      });
      return;
    }

    if (rawSchedules.length > 0) {
      cachedScheduleData = payload;
      lastScheduleFetchTime = Date.now();
    }

    res.json({
      success: true,
      data: payload,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
