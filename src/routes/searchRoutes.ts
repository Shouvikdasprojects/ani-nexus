import { Router, Request, Response } from 'express';
import { Franchise } from '../models/Franchise.js';
import { malService } from '../services/malService.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';

export const searchRouter = Router();

/**
 * GET /api/v1/search?q=...
 * Typo-tolerant, multi-tier search across English, Romaji, and Native Kanji.
 * Auto-ingests from external sources if not present in local database!
 */
searchRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.status(400).json({ success: false, error: 'Query parameter ?q= is required.' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);

    // 1. Search in local MongoDB using Full-Text Index first, then Regex fallback
    let results: any[] = [];

    if (query.length >= 3) {
      try {
        results = await Franchise.find(
          { $text: { $search: query } },
          {
            textScore: { $meta: 'textScore' },
            titles: 1,
            slug: 1,
            images: 1,
            classification: 1,
            contentRating: 1,
            'timeline.scores': 1,
            'timeline.languages': 1,
            'timeline.year': 1,
            totalEpisodes: 1,
          }
        )
          .sort({ textScore: { $meta: 'textScore' }, 'timeline.0.scores.combinedAverage': -1 })
          .limit(limit)
          .lean();
      } catch {
        // Silent fallback to regex
      }
    }

    if (results.length === 0) {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      results = await Franchise.find(
        {
          $or: [
            { 'titles.primary': regex },
            { 'titles.english': regex },
            { 'titles.romaji': regex },
            { 'titles.native': regex },
            { 'titles.synonyms': regex },
            { slug: regex },
          ],
        },
        {
          titles: 1,
          slug: 1,
          images: 1,
          classification: 1,
          contentRating: 1,
          'timeline.scores': 1,
          'timeline.languages': 1,
          'timeline.year': 1,
          totalEpisodes: 1,
        }
      )
        .sort({ 'timeline.0.scores.combinedAverage': -1 })
        .limit(limit)
        .lean();
    }

    // 2. Cache-Aside Fallback: If no matches in DB, search MAL & auto-ingest top result
    if (results.length === 0) {
      const malResults = await malService.searchAnime(query, 3);
      if (malResults && malResults.length > 0) {
        for (const item of malResults) {
          const built = await franchiseBuilder.buildFromMalId(item.id);
          if (built) {
            results.push(built.toObject() as any);
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        query,
        count: results.length,
        results,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/search/suggest?q=...
 * Fast autocomplete search suggestion pills
 */
searchRouter.get('/suggest', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.json({ success: true, data: [] });
      return;
    }

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const suggestions = await Franchise.find(
      {
        $or: [
          { 'titles.primary': regex },
          { 'titles.english': regex },
          { 'titles.romaji': regex },
          { slug: regex },
        ],
      },
      {
        'titles.primary': 1,
        'titles.english': 1,
        'titles.romaji': 1,
        slug: 1,
        'images.poster': 1,
        'timeline.year': 1,
      }
    )
      .limit(8)
      .lean();

    const pills = suggestions.map((s) => ({
      title: s.titles?.primary,
      slug: s.slug,
      poster: s.images?.poster,
      year: s.timeline?.[0]?.year || null,
    }));

    res.json({
      success: true,
      data: pills,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
