import { Router, Request, Response } from 'express';
import {
  getAllFranchiseModels,
  getAllCharacterModels,
  getAllStaffModels,
  getAllMangaModels,
} from '../config/database.js';
import {
  escapeRegex,
  findOneAcrossVaults,
  findMergedAcrossVaults,
  findUnpaginatedMergedAcrossVaults,
} from '../utils/vaultQuery.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import { malService } from '../services/malService.js';
import { anilistService } from '../services/anilistService.js';

export const seriesRouter = Router();

/**
 * Helper to query seamlessly across Vault 1, Vault 1B & legacy fallback
 */
async function findFranchise(filter: any, projection?: any) {
  return findOneAcrossVaults(getAllFranchiseModels(), filter, projection);
}

/**
 * GET /api/v1/series/:slug
 * Retrieve complete Master Franchise Document.
 * Auto-populates on demand if not found in database!
 */
seriesRouter.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    let franchise = await findFranchise({ slug });

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
    const franchise = await findFranchise({ slug }, { timeline: 1, titles: 1, images: 1 });

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Franchise '${slug}' not found.`,
      });
      return;
    }

    const timelineWithImages = franchise.timeline?.map((part: any) => ({
      ...part,
      images: part.images?.poster ? part.images : franchise.images,
    })) || [];

    res.json({
      success: true,
      data: {
        franchise: franchise.titles?.primary,
        slug,
        images: franchise.images,
        timeline: timelineWithImages,
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

    const franchise = await findFranchise({ slug }, { 'timeline.episodes': 1, 'timeline.partName': 1, titles: 1 });

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Franchise '${slug}' not found.`,
      });
      return;
    }

    // Collect episodes from all timeline parts
    let allEpisodes: any[] = [];
    franchise.timeline?.forEach((part: any) => {
      if (part.episodes && Array.isArray(part.episodes)) {
        part.episodes.forEach((ep: any) => {
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

/**
 * GET /api/v1/series/:slug/staff
 * Animation Studios & Production Staff with Verified Social Media Links
 */
seriesRouter.get('/:slug/staff', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const franchise = await findFranchise({ slug }, { studios: 1, staff: 1, titles: 1, timeline: 1 });

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Franchise '${slug}' not found.`,
      });
      return;
    }

    // Query Staff collections across BOTH Vault 1 & Vault 1B for exhaustive credits
    const mediaIds = (franchise.timeline || []).map((t: any) => t.ids?.aniId).filter(Boolean);
    const detailedStaff = await findUnpaginatedMergedAcrossVaults(getAllStaffModels(), {
      filter: {
        $or: [
          { 'roles.slug': slug },
          { 'roles.mediaId': { $in: mediaIds } },
        ],
      },
      dedupeKey: 'staffId',
    });

    const staffList = detailedStaff.length > 0 ? detailedStaff : (franchise.staff || []);

    res.json({
      success: true,
      data: {
        franchise: franchise.titles?.primary,
        slug,
        studios: franchise.studios || [],
        totalStaff: staffList.length,
        staff: staffList,
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
 * GET /api/v1/series/:slug/characters
 * Main & Supporting Characters with Multi-Lingual Voice Actors
 */
seriesRouter.get('/:slug/characters', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const franchise = await findFranchise({ slug }, { mainCharacters: 1, titles: 1, timeline: 1 });

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Franchise '${slug}' not found.`,
      });
      return;
    }

    // Query Character collections across BOTH Vault 1 & Vault 1B for exhaustive cast
    const mediaIds = (franchise.timeline || []).map((t: any) => t.ids?.aniId).filter(Boolean);
    const detailedChars = await findUnpaginatedMergedAcrossVaults(getAllCharacterModels(), {
      filter: {
        $or: [
          { 'animeAppearances.slug': slug },
          { 'animeAppearances.mediaId': { $in: mediaIds } },
        ],
      },
      sort: { favourites: -1 },
      dedupeKey: 'characterId',
    });

    const charList = detailedChars.length > 0 ? detailedChars : (franchise.mainCharacters || []);

    res.json({
      success: true,
      data: {
        franchise: franchise.titles?.primary,
        slug,
        totalCharacters: charList.length,
        characters: charList,
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
 * GET /api/v1/series/:slug/adaptations
 * Source Material & Reading Adaptations (Manga, Manhwa, Light Novel)
 */
seriesRouter.get('/:slug/adaptations', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const franchise = await findFranchise({ slug });

    if (!franchise) {
      res.status(404).json({
        success: false,
        error: `Franchise '${slug}' not found.`,
      });
      return;
    }

    // Query Vault 2 & Vault 2B for matching manga/novel by slug or adaptation link
    const safeTitle = franchise.titles?.primary ? escapeRegex(franchise.titles.primary) : '';
    const orFilters: any[] = [{ slug }, { 'adaptations.slug': slug }];
    if (safeTitle) {
      orFilters.push({ 'titles.primary': new RegExp(safeTitle, 'i') });
    }
    const matchingManga = await findUnpaginatedMergedAcrossVaults(getAllMangaModels(), {
      filter: {
        $or: orFilters,
      },
      dedupeKey: 'slug',
    });

    res.json({
      success: true,
      data: {
        franchise: franchise.titles?.primary,
        slug,
        totalAdaptations: matchingManga.length,
        sourceMaterials: matchingManga.map((m) => ({
          title: m.titles?.primary,
          slug: m.slug,
          type: m.type, // 'MANGA' | 'MANHWA' | 'LIGHT_NOVEL'
          status: m.status,
          chapters: m.chapters,
          volumes: m.volumes,
          score: m.scores?.weightedAverage,
          cover: m.images?.cover,
          creators: m.creators,
        })),
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
 * GET /api/v1/series/:slug/reviews
 * Community reviews fetched dynamically via AniList ID
 */
seriesRouter.get('/:slug/reviews', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const franchise = await findFranchise({ slug }, { slug: 1, 'timeline.ids': 1 });
    if (!franchise) {
      res.status(404).json({ success: false, error: `Franchise '${slug}' not found.` });
      return;
    }

    const aniId = franchise.timeline?.[0]?.ids?.aniId;
    const reviews = aniId ? await anilistService.getMediaReviews(aniId, 10) : [];
    res.json({ success: true, data: { slug, reviews } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/series/:slug/recommendations
 * Stored paired recommendations, or genre-matched top franchises across Vault 1 & 1B
 */
seriesRouter.get('/:slug/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = String(req.params.slug);
    const franchise = await findFranchise(
      { slug },
      { slug: 1, recommendations: 1, 'classification.genres.slug': 1 }
    );
    if (!franchise) {
      res.status(404).json({ success: false, error: `Franchise '${slug}' not found.` });
      return;
    }

    let recs = (franchise.recommendations || []).map((r: any, idx: number) => ({
      id: `${slug}-rec-${idx}`,
      sourceSlug: slug,
      targetSlug: r.targetSlug,
      targetTitle: r.targetTitle,
      targetPoster: r.targetPoster || '/placeholder.jpg',
      targetFormat: r.targetFormat,
      targetScore: r.targetScore,
      reason: 'Recommended by fans who enjoyed similar themes and pacing.',
      votes: r.votes || 1,
    }));

    if (recs.length === 0 && franchise.classification?.genres?.length) {
      const genreSlugs = franchise.classification.genres.slice(0, 2).map((g: any) => g.slug);
      const { results: similar } = await findMergedAcrossVaults(getAllFranchiseModels(), {
        filter: { slug: { $ne: slug }, 'contentRating.isAdult': { $ne: true }, 'classification.genres.slug': { $in: genreSlugs } },
        projection: { slug: 1, 'titles.primary': 1, 'images.poster': 1, 'timeline.format': 1, 'timeline.scores.combinedAverage': 1 },
        sort: { 'timeline.0.scores.combinedAverage': -1 },
        skip: 0,
        limit: 6,
        dedupeKey: 'slug',
      });
      recs = similar.map((s: any, idx: number) => ({
        id: `${slug}-genre-rec-${idx}`,
        sourceSlug: slug,
        targetSlug: s.slug,
        targetTitle: s.titles?.primary || s.slug,
        targetPoster: s.images?.poster || '/placeholder.jpg',
        targetFormat: s.timeline?.[0]?.format || 'TV',
        targetScore: s.timeline?.[0]?.scores?.combinedAverage || undefined,
        reason: `Shares core genres (${genreSlugs.join(', ')}) and top community rating.`,
        votes: 1,
      }));
    }

    res.json({ success: true, data: { slug, recommendations: recs } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
