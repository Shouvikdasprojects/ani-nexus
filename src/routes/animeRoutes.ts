import { Router, Request, Response } from 'express';
import { Franchise } from '../models/Franchise.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';

export const animeRouter = Router();

/**
 * GET /api/v1/anime/:idOrSlug
 * Find single anime part by MAL ID, AniList ID, or partId
 */
animeRouter.get('/:idOrSlug', async (req: Request, res: Response): Promise<void> => {
  try {
    const idOrSlug = String(req.params.idOrSlug);
    const isNumeric = /^\d+$/.test(idOrSlug);

    let query: any = {};
    if (isNumeric) {
      const numId = Number(idOrSlug);
      query = {
        $or: [
          { 'timeline.ids.malId': numId },
          { 'timeline.ids.aniId': numId },
        ],
      };
    } else {
      query = {
        $or: [
          { slug: idOrSlug },
          { 'timeline.partId': idOrSlug },
        ],
      };
    }

    let franchise = await Franchise.findOne(query).lean();

    // On-demand fetch if numeric ID provided and not yet cached
    if (!franchise && isNumeric) {
      const numId = Number(idOrSlug);
      const built = await franchiseBuilder.buildFromMalId(numId);
      if (built) {
        franchise = built.toObject();
      }
    }

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Anime matching '${idOrSlug}' not found in AniNexus database.`,
      });
      return;
    }

    // Find the exact matching timeline part if numeric or partId
    let matchedPart = franchise.timeline?.[0];
    if (isNumeric) {
      const numId = Number(idOrSlug);
      matchedPart = franchise.timeline?.find(
        (p) => p.ids?.malId === numId || p.ids?.aniId === numId
      ) || franchise.timeline?.[0];
    } else {
      const foundPart = franchise.timeline?.find((p) => p.partId === idOrSlug);
      if (foundPart) matchedPart = foundPart;
    }

    res.json({
      success: true,
      data: {
        franchiseSlug: franchise.slug,
        franchiseTitles: franchise.titles,
        part: matchedPart,
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
 * GET /api/v1/anime/:idOrSlug/languages
 * Direct verified Audio Dubs & Subtitles
 */
animeRouter.get('/:idOrSlug/languages', async (req: Request, res: Response): Promise<void> => {
  try {
    const idOrSlug = String(req.params.idOrSlug);
    const isNumeric = /^\d+$/.test(idOrSlug);

    const query = isNumeric
      ? {
          $or: [
            { 'timeline.ids.malId': Number(idOrSlug) },
            { 'timeline.ids.aniId': Number(idOrSlug) },
          ],
        }
      : {
          $or: [
            { slug: idOrSlug },
            { 'timeline.partId': idOrSlug },
          ],
        };

    const franchise = await Franchise.findOne(query, { timeline: 1, titles: 1 }).lean();

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Anime '${idOrSlug}' not found.`,
      });
      return;
    }

    // Collect all dubs across parts
    const allAudioDubs = new Set<string>();
    const allSubtitles = new Set<string>();

    franchise.timeline?.forEach((p) => {
      p.languages?.audioDubs?.forEach((d) => allAudioDubs.add(d));
      p.languages?.subtitles?.forEach((s) => allSubtitles.add(s));
    });

    res.json({
      success: true,
      data: {
        franchise: franchise.titles?.primary,
        verifiedAudioDubs: Array.from(allAudioDubs),
        subtitles: Array.from(allSubtitles),
        disclaimer: 'Audio dub verification sourced directly from official voice actor casting databases.',
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
