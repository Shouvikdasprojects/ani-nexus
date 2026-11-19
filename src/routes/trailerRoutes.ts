import { Router, Request, Response } from 'express';
import { Franchise } from '../models/Franchise.js';

export const trailerRouter = Router();

/**
 * GET /api/v1/trailers
 * High-definition YouTube trailer feed for carousel displays
 */
trailerRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const franchises = await Franchise.find(
      { 'timeline.trailer': { $ne: null } },
      { titles: 1, slug: 1, 'timeline.trailer': 1, 'timeline.partName': 1, images: 1 }
    )
      .sort({ lastUpdated: -1 })
      .limit(limit)
      .lean();

    const trailers: any[] = [];
    franchises.forEach((f) => {
      f.timeline?.forEach((part) => {
        if (part.trailer && part.trailer.id) {
          trailers.push({
            franchiseSlug: f.slug,
            franchiseTitle: f.titles?.primary,
            partName: part.partName,
            poster: f.images?.poster,
            backdrop: f.images?.backdrop,
            trailer: part.trailer,
          });
        }
      });
    });

    res.json({
      success: true,
      data: {
        total: trailers.length,
        trailers: trailers.slice(0, limit),
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
