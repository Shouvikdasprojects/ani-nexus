import { Router, Request, Response } from 'express';
import { awardService } from '../services/awardService.js';

export const awardRouter = Router();

/**
 * GET /api/v1/awards
 * Overview of Anime Awards, latest year, rolling window, and available editions
 */
awardRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const overview = await awardService.getOverview();
    res.json({
      success: true,
      data: overview,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/awards/latest
 * Get full data of the most recent Anime Awards edition
 */
awardRouter.get('/latest', async (_req: Request, res: Response) => {
  try {
    const latest = await awardService.getLatestAwards();
    if (!latest) {
      return res.status(404).json({ success: false, message: 'No award editions found.' });
    }
    res.json({
      success: true,
      data: latest,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/awards/current
 * Alias for latest
 */
awardRouter.get('/current', async (_req: Request, res: Response) => {
  try {
    const latest = await awardService.getLatestAwards();
    if (!latest) {
      return res.status(404).json({ success: false, message: 'No award editions found.' });
    }
    res.json({
      success: true,
      data: latest,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/awards/category/:categorySlug
 * Track history of a category across the rolling window (e.g. "anime-of-the-year")
 */
awardRouter.get('/category/:categorySlug', async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const history = await awardService.getCategoryHistory(String(categorySlug));
    res.json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/awards/prune
 * Manual trigger for 5-year rolling purge
 */
awardRouter.post('/prune', async (_req: Request, res: Response) => {
  try {
    const result = await awardService.pruneOutdatedAwards();
    res.json({
      success: true,
      message: 'Rolling window pruning executed successfully.',
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/awards/:year
 * Get awards for a specific year (e.g. 2026, 2025, 2024, 2023, 2022, 2021)
 */
awardRouter.get('/:year', async (req: Request, res: Response) => {
  try {
    const year = parseInt(String(req.params.year), 10);
    if (isNaN(year)) {
      return res.status(400).json({ success: false, error: 'Invalid year parameter. Must be a 4-digit number.' });
    }

    const result = await awardService.getAwardsByYear(year);

    if (result && 'status' in result && result.status === 'purged') {
      return res.status(410).json({
        success: false,
        message: result.message,
        cutoffYear: result.cutoffYear,
        latestYear: result.latestYear,
        retentionPolicy: 'Only the active year and past 5 years are retained. Older data is automatically purged.',
      });
    }

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return res.status(404).json({
        success: false,
        message: `No award records found for year ${year}.`,
      });
    }

    res.json({
      success: true,
      year,
      count: Array.isArray(result) ? result.length : 1,
      data: Array.isArray(result) && result.length === 1 ? result[0] : result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
