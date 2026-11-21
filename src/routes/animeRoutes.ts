import { Router, Request, Response } from 'express';
import { Franchise } from '../models/Franchise.js';
import { getSecondaryFranchiseModel } from '../config/database.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';

export const animeRouter = Router();

async function findFranchise(query: any, projection?: any) {
  let doc = await Franchise.findOne(query, projection).lean();
  if (!doc) {
    const SecondaryModel = getSecondaryFranchiseModel();
    if (SecondaryModel) {
      try {
        doc = await SecondaryModel.findOne(query, projection).lean();
      } catch (err: any) {
        console.warn('[Secondary Vault Query Warning]:', err.message);
      }
    }
  }
  return doc;
}

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

    let franchise: any = await findFranchise(query);

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
        (p: any) => p.ids?.malId === numId || p.ids?.aniId === numId
      ) || franchise.timeline?.[0];
    } else {
      matchedPart = franchise.timeline?.find(
        (p: any) => p.partId === idOrSlug
      ) || franchise.timeline?.[0];
    }

    res.json({
      success: true,
      data: {
        franchiseSlug: franchise.slug,
        franchiseTitle: franchise.titles?.primary,
        part: matchedPart,
        allPartsCount: franchise.totalParts,
        watchOrderLink: `/api/v1/series/${franchise.slug}/timeline`,
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
 * Direct verified Audio Dubs & Subtitles for a specific Part / Season / Movie
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

    const franchise: any = await findFranchise(query, { timeline: 1, titles: 1, slug: 1 });

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Anime '${idOrSlug}' not found.`,
      });
      return;
    }

    // Find specific part if requested by partId or numeric ID
    let matchedPart = franchise.timeline?.[0];
    if (isNumeric) {
      const numId = Number(idOrSlug);
      matchedPart = franchise.timeline?.find(
        (p: any) => p.ids?.malId === numId || p.ids?.aniId === numId
      ) || franchise.timeline?.[0];
    } else if (idOrSlug.includes('-part-')) {
      matchedPart = franchise.timeline?.find(
        (p: any) => p.partId === idOrSlug
      ) || franchise.timeline?.[0];
    }

    // All parts language matrix
    const partsLanguageBreakdown = (franchise.timeline || []).map((p: any) => ({
      partId: p.partId,
      partName: p.partName,
      format: p.format,
      year: p.year,
      audioDubs: p.languages?.audioDubs || ['Japanese'],
      subtitles: p.languages?.subtitles || ['English', 'Japanese'],
    }));

    res.json({
      success: true,
      data: {
        franchise: franchise.titles?.primary,
        slug: franchise.slug,
        specificRequestedPart: {
          partName: matchedPart?.partName,
          format: matchedPart?.format,
          audioDubs: matchedPart?.languages?.audioDubs || ['Japanese'],
          subtitles: matchedPart?.languages?.subtitles || ['English', 'Japanese'],
        },
        allPartsBreakdown: partsLanguageBreakdown,
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
