import { Router, Request, Response } from 'express';
import { getAllFranchiseModels } from '../config/database.js';
import { findUnpaginatedMergedAcrossVaults } from '../utils/vaultQuery.js';

export const studioRouter = Router();

function slugifyStudio(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * GET /api/v1/studios
 * Aggregates unique animation studios and their top works across Vault 1 & Vault 1B
 */
studioRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const franchises = await findUnpaginatedMergedAcrossVaults(getAllFranchiseModels(), {
      filter: { 'studios.0': { $exists: true } },
      projection: {
        slug: 1,
        'titles.primary': 1,
        'images.poster': 1,
        'studios.studioId': 1,
        'studios.name': 1,
        'studios.isAnimationStudio': 1,
        'timeline.scores.combinedAverage': 1,
      },
      dedupeKey: 'slug',
    });

    const studioMap = new Map<
      string,
      {
        id: number;
        slug: string;
        name: string;
        animeCount: number;
        topWorks: Array<{ slug: string; title: string; poster: string; score?: number }>;
      }
    >();

    for (const f of franchises) {
      const score = f.timeline?.[0]?.scores?.combinedAverage || undefined;
      for (const s of f.studios || []) {
        if (!s?.name || s.isAnimationStudio === false) continue;
        const slug = slugifyStudio(s.name);
        if (!slug) continue;

        let entry = studioMap.get(slug);
        if (!entry) {
          entry = {
            id: s.studioId || 0,
            slug,
            name: s.name,
            animeCount: 0,
            topWorks: [],
          };
          studioMap.set(slug, entry);
        }
        entry.animeCount++;
        entry.topWorks.push({
          slug: f.slug,
          title: f.titles?.primary || f.slug,
          poster: f.images?.poster || '',
          score,
        });
      }
    }

    const studios = Array.from(studioMap.values())
      .map((st) => ({
        ...st,
        topWorks: st.topWorks
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 4),
      }))
      .sort((a, b) => b.animeCount - a.animeCount);

    res.json({
      success: true,
      data: {
        total: studios.length,
        studios,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/studios/:slug
 * Retrieve a single studio's details and all associated anime across vaults
 */
studioRouter.get('/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const targetSlug = String(req.params.slug).toLowerCase().trim();
    const franchises = await findUnpaginatedMergedAcrossVaults(getAllFranchiseModels(), {
      filter: { 'studios.0': { $exists: true } },
      projection: {
        slug: 1,
        'titles.primary': 1,
        'images.poster': 1,
        'studios.studioId': 1,
        'studios.name': 1,
        'timeline.scores.combinedAverage': 1,
      },
      dedupeKey: 'slug',
    });

    let matchedStudio: any = null;
    const works: Array<{ slug: string; title: string; poster: string; score?: number }> = [];

    for (const f of franchises) {
      const studioObj = (f.studios || []).find((s: any) => s?.name && slugifyStudio(s.name) === targetSlug);
      if (studioObj) {
        if (!matchedStudio) {
          matchedStudio = {
            id: studioObj.studioId || 0,
            slug: targetSlug,
            name: studioObj.name,
          };
        }
        works.push({
          slug: f.slug,
          title: f.titles?.primary || f.slug,
          poster: f.images?.poster || '',
          score: f.timeline?.[0]?.scores?.combinedAverage || undefined,
        });
      }
    }

    if (!matchedStudio) {
      res.status(404).json({ success: false, error: `Studio '${targetSlug}' not found.` });
      return;
    }

    works.sort((a, b) => (b.score || 0) - (a.score || 0));

    res.json({
      success: true,
      data: {
        studio: {
          ...matchedStudio,
          animeCount: works.length,
          topWorks: works,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
