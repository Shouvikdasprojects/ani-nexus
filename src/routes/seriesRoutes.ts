import { Router, Request, Response } from 'express';
import { Franchise } from '../models/Franchise.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import { malService } from '../services/malService.js';

export const seriesRouter = Router();

/**
 * GET /api/v1/series/:slug
 * Retrieve complete Master Franchise Document.
 * Auto-populates on demand if not found in database!
 */
seriesRouter.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    let franchise = await Franchise.findOne({ slug }).lean();

    // On-Demand Ingestion: if not in database, attempt search & build
    if (!franchise) {
      // Try searching MAL for this title
      const cleanTitle = slug.replace(/-/g, ' ');
      const searchResults = await malService.searchAnime(cleanTitle, 1);

      if (searchResults && searchResults.length > 0) {
        const malId = searchResults[0].id;
        const newFranchise = await franchiseBuilder.buildFromMalId(malId);
        if (newFranchise) {
          franchise = newFranchise.toObject();
        }
      }
    } else {
      // Stale-While-Revalidate: check if revalidateAfter has passed
      const now = new Date();
      if (franchise.revalidateAfter && new Date(franchise.revalidateAfter) < now) {
        // Trigger background revalidation non-blockingly
        const malId = franchise.timeline?.[0]?.ids?.malId;
        if (malId) {
          franchiseBuilder.buildFromMalId(malId).catch((err) => {
            console.warn(`[Background Revalidation] Failed for ${slug}:`, err.message);
          });
        }
      }
    }

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Franchise '${slug}' not found in AniNexus database.`,
      });
      return;
    }

    res.json({
      success: true,
      data: franchise,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/v1/series/:slug/timeline
 * Watch Order & Chronological Roadmap
 */
seriesRouter.get('/:slug/timeline', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const franchise = await Franchise.findOne({ slug }, { timeline: 1, titles: 1 }).lean();

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Franchise '${slug}' not found.`,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        franchise: franchise.titles?.primary,
        slug,
        timeline: franchise.timeline,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/v1/series/:slug/episodes
 * Complete Episode Breakdown with HD Stills and Synopses
 */
seriesRouter.get('/:slug/episodes', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const { season } = req.query;

    const franchise = await Franchise.findOne({ slug }, { 'timeline.episodes': 1, 'timeline.partName': 1, titles: 1 }).lean();

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Franchise '${slug}' not found.`,
      });
      return;
    }

    // Collect episodes from all timeline parts
    let allEpisodes: any[] = [];
    franchise.timeline?.forEach((part) => {
      if (part.episodes && Array.isArray(part.episodes)) {
        part.episodes.forEach((ep) => {
          allEpisodes.push({
            partName: part.partName,
            ...ep,
          });
        });
      }
    });

    if (season) {
      const seasonNum = Number(season);
      allEpisodes = allEpisodes.filter((e) => e.season === seasonNum);
    }

    res.json({
      success: true,
      data: {
        franchise: franchise.titles?.primary,
        slug,
        totalEpisodes: allEpisodes.length,
        episodes: allEpisodes,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
