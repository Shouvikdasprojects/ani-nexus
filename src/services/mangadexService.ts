/**
 * MangaDex Integration Service
 * 
 * Provides live chapter catalogs, release dates, scanlation groups,
 * and 100% legal official reading source redirects (MangaPlus, Viz, Webtoons, etc.)
 * WITHOUT hosting pirated raw page images.
 * 
 * @author Shouvik Das
 */

interface IMangaDexSearchResult {
  mangadexId: string;
  title: string;
  status: string;
  links: Record<string, string>;
  officialReadingUrl?: string;
  rawUrl?: string;
}

export interface IMangaChapter {
  id: string;
  chapter: string;
  volume: string | null;
  title: string | null;
  releaseDate: string;
  externalUrl: string | null;
  isOfficial: boolean;
  scanlationGroup: string | null;
}

class MangaDexService {
  private baseUrl = 'https://api.mangadex.org';
  private headers = {
    'Accept': 'application/json',
    'User-Agent': 'AniNexus-Intelligence-Platform/1.0 (https://aninexus-api-website.pages.dev)',
  };
  private cache = new Map<string, { data: any; expiresAt: number }>();

  private getCached<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.data as T;
  }

  private setCache<T>(key: string, data: T, ttlSeconds = 1800): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Find a Manga on MangaDex by title and verify against AniList / MAL IDs
   */
  public async findManga(query: {
    title: string;
    aniId?: number;
    malId?: number;
  }): Promise<IMangaDexSearchResult | null> {
    const cacheKey = `md_search_${query.title}_${query.aniId}_${query.malId}`;
    const cached = this.getCached<IMangaDexSearchResult>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/manga?title=${encodeURIComponent(query.title)}&limit=10&includes[]=cover_art`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) return null;

      const json: any = await res.json();
      if (!json?.data || !json.data.length) return null;

      let matchedItem: any = null;

      // 1. Try exact match by AniList ID or MAL ID in attributes.links
      if (query.aniId || query.malId) {
        matchedItem = json.data.find((m: any) => {
          const links = m.attributes?.links || {};
          if (query.aniId && links.al && String(links.al) === String(query.aniId)) return true;
          if (query.malId && links.mal && String(links.mal) === String(query.malId)) return true;
          return false;
        });
      }

      // 2. Fallback to first result
      if (!matchedItem) {
        matchedItem = json.data[0];
      }

      const links = matchedItem.attributes?.links || {};
      const primaryTitle =
        matchedItem.attributes?.title?.en ||
        matchedItem.attributes?.title?.['ja-ro'] ||
        matchedItem.attributes?.title?.['ko-ro'] ||
        Object.values(matchedItem.attributes?.title || {})[0] ||
        query.title;

      const result: IMangaDexSearchResult = {
        mangadexId: matchedItem.id,
        title: primaryTitle,
        status: matchedItem.attributes?.status || 'unknown',
        links,
        officialReadingUrl: links.engtl || undefined,
        rawUrl: links.raw || undefined,
      };

      this.setCache(cacheKey, result, 3600); // cache for 1 hr
      return result;
    } catch (err: any) {
      console.warn(`[MangaDexService] Search failed for '${query.title}':`, err.message);
      return null;
    }
  }

  /**
   * Fetch chapter index with release timestamps, scanlation group, and official external reading links
   */
  public async getChapters(
    mangadexId: string,
    options: { language?: string; limit?: number; offset?: number } = {}
  ): Promise<{ total: number; chapters: IMangaChapter[] }> {
    const lang = options.language || 'en';
    const limit = Math.min(options.limit || 50, 100);
    const offset = Math.max(options.offset || 0, 0);

    const cacheKey = `md_ch_${mangadexId}_${lang}_${limit}_${offset}`;
    const cached = this.getCached<{ total: number; chapters: IMangaChapter[] }>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/chapter?manga=${mangadexId}&translatedLanguage[]=${lang}&order[chapter]=desc&limit=${limit}&offset=${offset}&includes[]=scanlation_group`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) {
        return { total: 0, chapters: [] };
      }

      const json: any = await res.json();
      const rawChapters = json?.data || [];
      const total = json?.total || rawChapters.length;

      const chapters: IMangaChapter[] = rawChapters.map((ch: any) => {
        const scanGroup = ch.relationships?.find((r: any) => r.type === 'scanlation_group');
        const externalUrl = ch.attributes?.externalUrl || null;

        return {
          id: ch.id,
          chapter: ch.attributes?.chapter || '0',
          volume: ch.attributes?.volume || null,
          title: ch.attributes?.title || null,
          releaseDate: ch.attributes?.readableAt || ch.attributes?.publishAt || new Date().toISOString(),
          externalUrl,
          isOfficial: Boolean(externalUrl),
          scanlationGroup: scanGroup?.attributes?.name || (externalUrl ? 'Official Publisher' : 'Community'),
        };
      });

      const result = { total, chapters };
      this.setCache(cacheKey, result, 1800); // 30 mins
      return result;
    } catch (err: any) {
      console.warn(`[MangaDexService] Failed fetching chapters for ${mangadexId}:`, err.message);
      return { total: 0, chapters: [] };
    }
  }
}

export const mangadexService = new MangaDexService();
