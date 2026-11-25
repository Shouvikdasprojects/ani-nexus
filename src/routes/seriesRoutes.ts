import { Router, Request, Response } from 'express';
import {
  getAllFranchiseModels,
  getAllCharacterModels,
  getAllStaffModels,
  getAllMangaModels,
} from '../config/database.js';
import {
  findOneAcrossVaults,
  findUnpaginatedMergedAcrossVaults,
} from '../utils/vaultQuery.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import { malService } from '../services/malService.js';

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
    const matchingManga = await findUnpaginatedMergedAcrossVaults(getAllMangaModels(), {
      filter: {
        $or: [
          { slug },
          { 'adaptations.slug': slug },
          { 'titles.primary': new RegExp(franchise.titles?.primary || '', 'i') },
        ],
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
