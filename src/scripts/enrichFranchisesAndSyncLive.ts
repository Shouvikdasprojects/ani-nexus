import {
  connectDatabase,
  getAllFranchiseModels,
} from '../config/database.js';
import { anilistService } from '../services/anilistService.js';
import { franchiseBuilder } from '../services/franchiseBuilder.js';
import { findOneAcrossVaults } from '../utils/vaultQuery.js';

const GRAPHQL_URL = 'https://graphql.anilist.co';

async function fetchAniListPage(sort: string[], status?: string, perPage = 25): Promise<any[]> {
  const query = `
    query ($sort: [MediaSort], $status: MediaStatus, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, sort: $sort, status: $status, isAdult: false) {
          id
          idMal
          title { romaji english }
        }
      }
    }
  `;
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables: { sort, status, perPage } }),
  });
  const json: any = await res.json();
  return json?.data?.Page?.media || [];
}

async function run() {
  await connectDatabase();
  const franchiseModels = getAllFranchiseModels();

  console.log('🚀 Step 1: Syncing missing Trending / Airing / Upcoming anime...');
  const [trending, airing, upcoming] = await Promise.all([
    fetchAniListPage(['TRENDING_DESC']),
    fetchAniListPage(['POPULARITY_DESC'], 'RELEASING'),
    fetchAniListPage(['POPULARITY_DESC'], 'NOT_YET_RELEASED'),
  ]);

  const seen = new Set<number>();
  const combined = [...trending, ...airing, ...upcoming].filter((m) => {
    if (!m?.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  let syncedNew = 0;
  for (const item of combined) {
    const exists = await findOneAcrossVaults(
      franchiseModels,
      { $or: [{ 'timeline.ids.aniId': item.id }, ...(item.idMal ? [{ 'timeline.ids.malId': item.idMal }] : [])] },
      { _id: 1 }
    );
    if (exists) continue;

    try {
      const fullAni = item.idMal ? await anilistService.getAnimeByMalId(item.idMal) : null;
      if (fullAni) {
        await franchiseBuilder.buildFromAniListMedia(fullAni, item.idMal);
        syncedNew++;
        console.log(`✅ Synced live anime: ${item.title?.english || item.title?.romaji}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Failed syncing ${item.title?.romaji}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 900));
  }
  console.log(`🎉 Step 1 complete: Synced ${syncedNew} new Trending/Airing/Upcoming anime.\n`);

  console.log('🚀 Step 2: Backfilling existing franchises (tags, relations, scoreDistribution, externalLinks, recommendations)...');
  let enriched = 0;
  for (const Model of franchiseModels) {
    const docs = await Model.find(
      { 'scoreDistribution.0': { $exists: false } },
      { _id: 1, slug: 1, timeline: 1 }
    ).lean();

    for (const doc of docs) {
      const aniId = (doc as any).timeline?.[0]?.ids?.aniId;
      const malId = (doc as any).timeline?.[0]?.ids?.malId;
      if (!aniId && !malId) continue;

      try {
        const aniMedia = malId ? await anilistService.getAnimeByMalId(malId) : null;
        if (!aniMedia) continue;

        const tags = (aniMedia.tags || []).slice(0, 15).map((t: any) => ({ name: t.name, rank: t.rank }));
        const scoreDistribution = aniMedia.stats?.scoreDistribution || [];
        const statusDistribution = aniMedia.stats?.statusDistribution || [];
        const externalLinks = (aniMedia.externalLinks || []).map((l: any) => ({
          site: l.site,
          type: l.type,
          url: l.url,
        }));
        const recommendations = (aniMedia.recommendations?.nodes || [])
          .filter((n: any) => n.mediaRecommendation)
          .map((n: any) => {
            const recTitle = n.mediaRecommendation.title?.english || n.mediaRecommendation.title?.romaji || 'Unknown';
            const recSlug = recTitle.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
            return {
              targetSlug: recSlug,
              targetTitle: recTitle,
              targetPoster: n.mediaRecommendation.coverImage?.large || null,
              targetFormat: n.mediaRecommendation.format || 'TV',
              targetScore: n.mediaRecommendation.averageScore ? n.mediaRecommendation.averageScore / 10 : null,
              votes: n.rating || 1,
            };
          });
        const relations = (aniMedia.relations?.edges || [])
          .filter((e: any) => e.node)
          .map((e: any) => {
            const relTitle = e.node.title?.english || e.node.title?.romaji || 'Unknown';
            const relSlug = relTitle.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
            return {
              relationType: e.relationType,
              id: e.node.id,
              idMal: e.node.idMal,
              slug: relSlug,
              type: e.node.type,
              format: e.node.format,
              title: relTitle,
              image: e.node.coverImage?.large || null,
            };
          });

        await Model.updateOne(
          { _id: doc._id },
          { $set: { tags, scoreDistribution, statusDistribution, externalLinks, recommendations, relations } }
        );
        enriched++;
        if (enriched % 25 === 0) console.log(`✅ Enriched ${enriched} franchises...`);
      } catch (err: any) {
        console.warn(`⚠️ Failed enriching ${(doc as any).slug}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 900));
    }
  }
  console.log(`🏁 All done! Synced ${syncedNew} new anime & enriched ${enriched} existing franchises.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
