import { config } from '../config/index.js';

class MalService {
  private keys: string[];
  private currentKeyIndex: number = 0;
  private keyCooldowns: Map<string, number> = new Map();

  constructor() {
    this.keys = config.mal.keysPool;
    if (this.keys.length === 0) {
      console.warn('⚠️ Warning: No MAL API Keys configured in environment.');
    } else {
      console.log(`🔑 MAL Service initialized with ${this.keys.length} API Keys in Round-Robin Pool.`);
    }
  }

  /**
   * Selects next active key from the pool, skipping any currently on 429 cooldown
   */
  private getNextApiKey(): string | null {
    if (this.keys.length === 0) return null;
    const now = Date.now();

    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentKeyIndex + i) % this.keys.length;
      const key = this.keys[idx];
      const cooldownUntil = this.keyCooldowns.get(key) || 0;

      if (now > cooldownUntil) {
        this.currentKeyIndex = (idx + 1) % this.keys.length;
        return key;
      }
    }

    // All keys in cooldown; fallback to the oldest key
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
    return this.keys[this.currentKeyIndex];
  }

  private markKeyCooldown(key: string, durationMs: number = 60000) {
    this.keyCooldowns.set(key, Date.now() + durationMs);
    console.warn(`[MAL Pool] Key ...${key.slice(-6)} temporarily cooled down for ${durationMs / 1000}s`);
  }

  async fetchFromMAL(endpoint: string): Promise<any | null> {
    const key = this.getNextApiKey();
    if (!key) return null;

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${config.mal.baseUrl}${cleanEndpoint}`;

    try {
      const res = await fetch(url, {
        headers: {
          'X-MAL-CLIENT-ID': key,
          Accept: 'application/json',
          'User-Agent': 'AniNexus/1.0',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.status === 429) {
        this.markKeyCooldown(key, 60000);
        // Try once more with next key in pool
        const fallbackKey = this.getNextApiKey();
        if (fallbackKey && fallbackKey !== key) {
          const retryRes = await fetch(url, {
            headers: {
              'X-MAL-CLIENT-ID': fallbackKey,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(6000),
          });
          if (retryRes.ok) return await retryRes.json();
        }
        return null;
      }

      if (!res.ok) {
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.warn(`[MAL Service Error] ${cleanEndpoint}:`, err.message);
      return null;
    }
  }

  async getAnimeDetails(malId: number): Promise<any | null> {
    const fields = [
      'id',
      'title',
      'main_picture',
      'alternative_titles',
      'start_date',
      'end_date',
      'synopsis',
      'mean',
      'rank',
      'popularity',
      'num_scoring_users',
      'nsfw',
      'media_type',
      'status',
      'genres',
      'num_episodes',
      'start_season',
      'broadcast',
      'source',
      'rating',
      'studios',
      'related_anime',
      'recommendations',
      'opening_themes',
      'ending_themes',
    ].join(',');

    return this.fetchFromMAL(`/anime/${malId}?fields=${fields}`);
  }

  async searchAnime(query: string, limit: number = 10): Promise<any[]> {
    if (!query) return [];
    const res = await this.fetchFromMAL(
      `/anime?q=${encodeURIComponent(query)}&limit=${limit}&fields=id,title,main_picture,mean,rank,media_type,start_date`
    );
    return res?.data?.map((item: any) => item.node) || [];
  }

  async getMangaDetails(malId: number): Promise<any | null> {
    const fields = [
      'id',
      'title',
      'main_picture',
      'alternative_titles',
      'start_date',
      'end_date',
      'synopsis',
      'mean',
      'rank',
      'popularity',
      'num_scoring_users',
      'nsfw',
      'media_type',
      'status',
      'genres',
      'num_volumes',
      'num_chapters',
      'authors{first_name,last_name}',
      'pictures',
      'background',
      'related_anime',
      'related_manga',
      'recommendations',
      'serialization{name}',
    ].join(',');

    return this.fetchFromMAL(`/manga/${malId}?fields=${fields}`);
  }

  async searchManga(query: string, limit: number = 10): Promise<any[]> {
    if (!query) return [];
    const res = await this.fetchFromMAL(
      `/manga?q=${encodeURIComponent(query)}&limit=${limit}&fields=id,title,main_picture,mean,rank,media_type,start_date`
    );
    return res?.data?.map((item: any) => item.node) || [];
  }

  async getTopManga(rankingType: string = 'all', limit: number = 50, offset: number = 0): Promise<any | null> {
    return this.fetchFromMAL(`/manga/ranking?ranking_type=${rankingType}&limit=${limit}&offset=${offset}`);
  }
}

export const malService = new MalService();
