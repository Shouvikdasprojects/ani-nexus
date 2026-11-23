import { Router, Request, Response } from 'express';
import { getMangaModel } from '../config/database.js';
import { mangaBuilder } from '../services/mangaBuilder.js';
import { mangadexService } from '../services/mangadexService.js';

export const mangaRouter = Router();

/**
 * GET /api/v1/manga
 * Omni-search & Filter for Manga, Manhwa, Manhua, and Light Novels
 * Query params: ?q=name &type=MANGA|MANHWA|MANHUA|LIGHT_NOVEL &status=RELEASING|FINISHED &genre=action &limit=20 &page=1
 */
mangaRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const MangaModel = getMangaModel();
    const q = req.query.q ? String(req.query.q).trim() : '';
    const type = req.query.type ? String(req.query.type).toUpperCase() : '';
    const country = req.query.country ? String(req.query.country).toUpperCase() : '';
    const status = req.query.status ? String(req.query.status).toUpperCase() : '';
    const genre = req.query.genre ? String(req.query.genre).trim() : '';
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (q) {
      filter.$or = [
        { 'titles.primary': new RegExp(q, 'i') },
        { 'titles.english': new RegExp(q, 'i') },
        { 'titles.romaji': new RegExp(q, 'i') },
        { 'titles.native': new RegExp(q, 'i') },
        { slug: new RegExp(q, 'i') },
      ];
    }

    if (type) {
      filter.type = type;
    }

    if (country) {
      filter.countryOfOrigin = country;
    }

    if (status) {
      filter.status = status;
    }

    if (genre) {
      filter['genres.slug'] = new RegExp(genre, 'i');
    }

    const [items, total] = await Promise.all([
      MangaModel.find(filter)
        .sort({ 'scores.popularity': -1, 'scores.weightedAverage': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MangaModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/manga/top
 * Curated Top Manga, Manhwa & Light Novels
 * Query params: ?type=popular | rated | manhwa | novels
 */
mangaRouter.get('/top', async (req: Request, res: Response): Promise<void> => {
  try {
    const MangaModel = getMangaModel();
    const type = String(req.query.type || 'popular').toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    let filter: any = {};
    let sortObj: any = { 'scores.popularity': -1 };

    switch (type) {
      case 'rated':
        filter['scores.weightedAverage'] = { $gt: 0 };
        sortObj = { 'scores.weightedAverage': -1, 'scores.popularity': -1 };
        break;

      case 'manhwa':
        filter.type = 'MANHWA';
        sortObj = { 'scores.popularity': -1, 'scores.weightedAverage': -1 };
        break;

      case 'novels':
        filter.type = { $in: ['LIGHT_NOVEL', 'WEB_NOVEL'] };
        sortObj = { 'scores.popularity': -1, 'scores.weightedAverage': -1 };
        break;

      case 'popular':
      default:
        sortObj = { 'scores.popularity': -1, 'scores.weightedAverage': -1 };
        break;
    }

    const items = await MangaModel.find(filter).sort(sortObj).limit(limit).lean();

    res.json({
      success: true,
      data: items,
      total: items.length,
      collection: type,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/manga/types
 * Category breakdowns with active counts
 */
mangaRouter.get('/types', async (_req: Request, res: Response): Promise<void> => {
  try {
    const MangaModel = getMangaModel();
    const types = ['MANGA', 'MANHWA', 'MANHUA', 'LIGHT_NOVEL', 'WEB_NOVEL', 'ONE_SHOT'];

    const counts = await Promise.all(
      types.map(async (t) => ({
        type: t,
        count: await MangaModel.countDocuments({ type: t }),
      }))
    );

    res.json({
      success: true,
      data: counts,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/manga/manhwa
 * Dedicated Korean Webtoons endpoint
 */
mangaRouter.get('/manhwa', async (req: Request, res: Response): Promise<void> => {
  try {
    const MangaModel = getMangaModel();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const items = await MangaModel.find({ type: 'MANHWA' })
      .sort({ 'scores.popularity': -1, 'scores.weightedAverage': -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: items,
      total: items.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/manga/:idOrSlug
 * Full Entry with On-Demand Dynamic Ingestion
 */
mangaRouter.get('/:idOrSlug', async (req: Request, res: Response): Promise<void> => {
  try {
    const MangaModel = getMangaModel();
    const param = String(req.params.idOrSlug).trim();
    const isNumeric = /^[0-9]+$/.test(param);

    let doc: any = null;

    if (isNumeric) {
      const numId = parseInt(param, 10);
      doc = await MangaModel.findOne({
        $or: [{ 'ids.aniId': numId }, { 'ids.malId': numId }],
      }).lean();

      if (!doc) {
        // Dynamic on-demand ingestion
        const built = await mangaBuilder.buildAndSaveManga({ aniId: numId });
        if (built) doc = built.toObject ? built.toObject() : built;
      }
    } else {
      doc = await MangaModel.findOne({ slug: param.toLowerCase() }).lean();
    }

    if (!doc) {
      res.status(404).json({
        success: false,
        error: `Manga/Novel entry '${param}' not found in Vault 2.`,
      });
      return;
    }

    res.json({
      success: true,
      data: doc,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/manga/:idOrSlug/adaptations
 * Cross-Media Adaptations (Anime & Series links)
 */
mangaRouter.get('/:idOrSlug/adaptations', async (req: Request, res: Response): Promise<void> => {
  try {
    const MangaModel = getMangaModel();
    const param = String(req.params.idOrSlug).trim();
    const isNumeric = /^[0-9]+$/.test(param);

    const doc = isNumeric
      ? await MangaModel.findOne({ $or: [{ 'ids.aniId': parseInt(param, 10) }, { 'ids.malId': parseInt(param, 10) }] }).lean()
      : await MangaModel.findOne({ slug: param.toLowerCase() }).lean();

    if (!doc) {
      res.status(404).json({ success: false, error: `Manga '${param}' not found.` });
      return;
    }

    res.json({
      success: true,
      data: {
        slug: doc.slug,
        title: doc.titles.primary,
        type: doc.type,
        totalAdaptations: doc.adaptations?.length || 0,
        adaptations: doc.adaptations || [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/manga/:idOrSlug/characters
 * Characters in this Manga / Novel
 */
mangaRouter.get('/:idOrSlug/characters', async (req: Request, res: Response): Promise<void> => {
  try {
    const MangaModel = getMangaModel();
    const param = String(req.params.idOrSlug).trim();
    const isNumeric = /^[0-9]+$/.test(param);

    const doc = isNumeric
      ? await MangaModel.findOne({ $or: [{ 'ids.aniId': parseInt(param, 10) }, { 'ids.malId': parseInt(param, 10) }] }).lean()
      : await MangaModel.findOne({ slug: param.toLowerCase() }).lean();

    if (!doc) {
      res.status(404).json({ success: false, error: `Manga '${param}' not found.` });
      return;
    }

    res.json({
      success: true,
      data: {
        slug: doc.slug,
        title: doc.titles.primary,
        characters: doc.characters || [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/manga/:idOrSlug/chapters
 * Live Chapter Index, Release Dates & Official Legal Reading Sources (Powered by MangaDex API)
 * Query params: ?limit=50 &page=1 &language=en
 */
mangaRouter.get('/:idOrSlug/chapters', async (req: Request, res: Response): Promise<void> => {
  try {
    const MangaModel = getMangaModel();
    const param = String(req.params.idOrSlug).trim();
    const isNumeric = /^[0-9]+$/.test(param);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const language = String(req.query.language || 'en').toLowerCase();

    const doc = isNumeric
      ? await MangaModel.findOne({ $or: [{ 'ids.aniId': parseInt(param, 10) }, { 'ids.malId': parseInt(param, 10) }] }).lean()
      : await MangaModel.findOne({ slug: param.toLowerCase() }).lean();

    if (!doc) {
      res.status(404).json({ success: false, error: `Manga '${param}' not found in Vault 2.` });
      return;
    }

    // Resolve Manga on MangaDex
    const mdManga = await mangadexService.findManga({
      title: doc.titles.english || doc.titles.romaji || doc.titles.primary,
      aniId: doc.ids?.aniId,
      malId: doc.ids?.malId,
    });

    if (!mdManga) {
      res.json({
        success: true,
        data: {
          slug: doc.slug,
          title: doc.titles.primary,
          totalChapters: doc.chapters || 0,
          source: 'vault-metadata',
          officialReadingUrl: doc.licensing?.officialReadingUrl || null,
          chapters: [],
          notice: 'Detailed live chapter index is not indexed on MangaDex yet.',
        },
      });
      return;
    }

    const { total, chapters } = await mangadexService.getChapters(mdManga.mangadexId, {
      language,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        slug: doc.slug,
        title: doc.titles.primary,
        mangadexId: mdManga.mangadexId,
        status: mdManga.status,
        officialReadingUrl: mdManga.officialReadingUrl || doc.licensing?.officialReadingUrl || null,
        rawUrl: mdManga.rawUrl || null,
        language,
        totalChapters: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        chapters,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

