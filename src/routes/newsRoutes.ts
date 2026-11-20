import { Router, Request, Response } from 'express';
import { newsService } from '../services/newsService.js';

export const newsRouter = Router();

/**
 * GET /api/v1/news
 * Auto-purging 60-day anime news feed (with verified cover photos)
 */
newsRouter.get('/news', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const items = await newsService.getNews(limit, page);
    res.json({
      success: true,
      data: {
        page,
        count: items.length,
        news: items,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/articles
 * Text-only editorial digests & industry analysis (without images)
 */
newsRouter.get('/articles', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const items = await newsService.getArticles(limit, page);
    res.json({
      success: true,
      data: {
        page,
        count: items.length,
        articles: items,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/news/sync or POST /api/v1/sync
 * Manually trigger RSS feed sync
 */
const handleSync = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await newsService.syncFeeds();
    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

newsRouter.post('/sync', handleSync);
newsRouter.post('/news/sync', handleSync);
