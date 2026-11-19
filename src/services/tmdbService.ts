import { config } from '../config/index.js';

export interface ITmdbImageSet {
  backdrop?: string | null;
  poster?: string | null;
  logo?: string | null;
}

export interface ITmdbWatchProvider {
  name: string;
  url: string;
  type: string;
}

export interface ITmdbEpisode {
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  stillPath: string | null;
}

class TmdbService {
  private apiKey: string;
  private readToken: string;
  private baseUrl: string;
  private imageBase: string;
  private isAvailable: boolean = true;
  private failureCount: number = 0;
  private retryAfter: number = 0;

  constructor() {
    this.apiKey = config.tmdb.apiKey;
    this.readToken = config.tmdb.readAccessToken;
    this.baseUrl = config.tmdb.baseUrl;
    this.imageBase = config.tmdb.imageBaseUrl;
  }

  private async fetchTmdb(path: string, queryParams: Record<string, string> = {}): Promise<any | null> {
    const now = Date.now();
    if (!this.isAvailable && now < this.retryAfter) {
      return null;
    }

    try {
      const url = new URL(`${this.baseUrl}${path}`);
      if (this.apiKey) {
        url.searchParams.set('api_key', this.apiKey);
      }
      for (const [k, v] of Object.entries(queryParams)) {
        url.searchParams.set(k, v);
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (this.readToken) {
        headers['Authorization'] = `Bearer ${this.readToken}`;
      }

      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(2000), // Fast 2s timeout
      });

      if (!res.ok) {
        return null;
      }

      // Reset failure counter on success
      this.isAvailable = true;
      this.failureCount = 0;
      return await res.json();
    } catch (err: any) {
      this.failureCount++;
      if (this.failureCount >= 2) {
        this.isAvailable = false;
        this.retryAfter = Date.now() + 10 * 60 * 1000; // Cooldown 10 mins before retrying
        console.warn(`[TMDB Circuit Breaker] TMDB unreachable on local network. Bypassing TMDB calls for 10m to maximize ingestion speed.`);
      }
      return null;
    }
  }

  /**
   * Search for anime TV show or Movie on TMDB by title
   */
  async searchAnime(title: string, year?: number): Promise<{ id: number; type: 'tv' | 'movie' } | null> {
    if (!title) return null;

    // Search TV shows first (most anime are TV series)
    const tvParams: Record<string, string> = { query: title };
    if (year) tvParams.first_air_date_year = String(year);
    const tvSearch = await this.fetchTmdb('/search/tv', tvParams);

    if (tvSearch?.results && tvSearch.results.length > 0) {
      return { id: tvSearch.results[0].id, type: 'tv' };
    }

    // Fallback: search movies
    const movieParams: Record<string, string> = { query: title };
    if (year) movieParams.primary_release_year = String(year);
    const movieSearch = await this.fetchTmdb('/search/movie', movieParams);

    if (movieSearch?.results && movieSearch.results.length > 0) {
      return { id: movieSearch.results[0].id, type: 'movie' };
    }

    return null;
  }

  /**
   * Fetch 4K backdrops, posters, and transparent PNG logos
   */
  async getImages(id: number, type: 'tv' | 'movie' = 'tv'): Promise<ITmdbImageSet> {
    const data = await this.fetchTmdb(`/${type}/${id}/images`, {
      include_image_language: 'en,ja,null',
    });

    if (!data) return {};

    // Find best backdrop
    const backdropPath = data.backdrops?.[0]?.file_path;
    // Find best transparent PNG logo (prefer english or transparent logo)
    const logoPath =
      data.logos?.find((l: any) => l.iso_639_1 === 'en')?.file_path ||
      data.logos?.[0]?.file_path;
    // Find best poster
    const posterPath =
      data.posters?.find((p: any) => p.iso_639_1 === 'en')?.file_path ||
      data.posters?.[0]?.file_path;

    return {
      backdrop: backdropPath ? `${this.imageBase}${backdropPath}` : null,
      logo: logoPath ? `${this.imageBase}${logoPath}` : null,
      poster: posterPath ? `${this.imageBase}${posterPath}` : null,
    };
  }

  /**
   * Fetch legal OTT watch providers (Crunchyroll, Netflix, Prime Video, etc.) powered by JustWatch
   */
  async getWatchProviders(id: number, type: 'tv' | 'movie' = 'tv'): Promise<ITmdbWatchProvider[]> {
    const data = await this.fetchTmdb(`/${type}/${id}/watch/providers`);
    if (!data?.results) return [];

    const providers: ITmdbWatchProvider[] = [];
    const seen = new Set<string>();

    // Check IN (India), US (United States), and Global regions
    const regions = ['IN', 'US', 'JP'];
    for (const region of regions) {
      const regData = data.results[region];
      if (!regData) continue;

      const directUrl = regData.link || 'https://www.justwatch.com';

      // Flatrate (Subscription streaming: Netflix, Crunchyroll, Prime)
      if (regData.flatrate && Array.isArray(regData.flatrate)) {
        for (const p of regData.flatrate) {
          if (!seen.has(p.provider_name)) {
            seen.add(p.provider_name);
            providers.push({
              name: p.provider_name,
              url: directUrl,
              type: 'subscription',
            });
          }
        }
      }

      // Free / Ad-supported (e.g. YouTube Muse Asia, Tubi)
      if (regData.free && Array.isArray(regData.free)) {
        for (const p of regData.free) {
          if (!seen.has(p.provider_name)) {
            seen.add(p.provider_name);
            providers.push({
              name: p.provider_name,
              url: directUrl,
              type: 'free',
            });
          }
        }
      }
    }

    return providers;
  }

  /**
   * Fetch episode directory for a season (HD stills, titles, synopses)
   */
  async getSeasonEpisodes(tvId: number, seasonNumber: number): Promise<ITmdbEpisode[]> {
    const data = await this.fetchTmdb(`/tv/${tvId}/season/${seasonNumber}`);
    if (!data?.episodes || !Array.isArray(data.episodes)) return [];

    return data.episodes.map((ep: any) => ({
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || '',
      airDate: ep.air_date || null,
      stillPath: ep.still_path ? `${this.imageBase}${ep.still_path}` : null,
    }));
  }
}

export const tmdbService = new TmdbService();
