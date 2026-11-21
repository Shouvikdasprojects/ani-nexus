import { Router, Request, Response } from 'express';
import { getCharacterModel } from '../config/database.js';
import { characterStaffService } from '../services/characterStaffService.js';

export const characterRouter = Router();

/**
 * GET /api/v1/characters/search?q={query}&limit=20
 * Search characters across entire universal archive
 */
characterRouter.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    if (!q) {
      res.status(400).json({ success: false, error: 'Query parameter ?q= is required.' });
      return;
    }

    const characters = await characterStaffService.searchCharacters(q, limit);

    res.json({
      success: true,
      query: q,
      total: characters.length,
      data: characters,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/characters/:idOrSlug
 * Retrieve comprehensive character dossier with all voice actors and anime appearances
 */
characterRouter.get('/:idOrSlug', async (req: Request, res: Response): Promise<void> => {
  try {
    const idOrSlug = String(req.params.idOrSlug).trim();
    const CharacterModel = getCharacterModel();

    let character: any = null;
    const numericId = Number(idOrSlug);

    if (!isNaN(numericId)) {
      character = await CharacterModel.findOne({
        $or: [{ characterId: numericId }, { malId: numericId }],
      }).lean();
    } else {
      character = await CharacterModel.findOne({
        $or: [
          { slug: idOrSlug },
          { slug: new RegExp(`^${idOrSlug}`, 'i') },
        ],
      }).lean();
    }

    // On-Demand Ingestion: if not in database, attempt real-time fetch & cache
    if (!character && !isNaN(numericId)) {
      const rawChar = await characterStaffService.fetchCharacterFromAniList(numericId);
      if (rawChar) {
        const saved = await characterStaffService.saveCharacter(rawChar);
        if (saved) character = saved.toObject();
      }
    }

    if (!character) {
      res.status(404).json({
        success: false,
        error: `Character '${idOrSlug}' not found in AniNexus archives.`,
      });
      return;
    }

    res.json({
      success: true,
      data: character,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
