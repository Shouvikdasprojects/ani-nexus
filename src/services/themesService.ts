import { config } from '../config/index.js';

export interface IAnimeSong {
  title: string;
  artist: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
}

export interface IThemeSongSet {
  openings: IAnimeSong[];
  endings: IAnimeSong[];
}

class ThemesService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.animethemes.baseUrl;
  }

  async getAnimeThemes(malId?: number | null, slugOrTitle?: string): Promise<IThemeSongSet> {
    const result: IThemeSongSet = {
      openings: [],
      endings: [],
    };

    if (!malId && !slugOrTitle) return result;

    try {
      let queryUrl = '';
      if (malId) {
        queryUrl = `${this.baseUrl}/anime?filter[has]=resources&include=animethemes.animethemeentries.videos,animethemes.song.artists&filter[resource]=${malId}`;
      } else if (slugOrTitle) {
        const query = encodeURIComponent(slugOrTitle);
        queryUrl = `${this.baseUrl}/anime?q=${query}&include=animethemes.animethemeentries.videos,animethemes.song.artists`;
      }

      const res = await fetch(queryUrl, {
        headers: { Accept: 'application/json', 'User-Agent': 'AniNexus/1.0' },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return result;

      const data: any = await res.json();
      const anime = data?.anime?.[0];
      if (!anime || !anime.animethemes) return result;

      for (const theme of anime.animethemes) {
        const type = theme.type; // 'OP' or 'ED'
        const songTitle = theme.song?.title || 'Unknown Title';
        const artist = theme.song?.artists?.[0]?.name || theme.song?.artist || 'Unknown Artist';

        const videoEntry = theme.animethemeentries?.[0]?.videos?.[0];
        const videoUrl = videoEntry?.link || null;
        const audioUrl = videoEntry?.audio?.link || null;

        const songObj: IAnimeSong = {
          title: songTitle,
          artist,
          videoUrl,
          audioUrl,
        };

        if (type === 'OP') {
          result.openings.push(songObj);
        } else if (type === 'ED') {
          result.endings.push(songObj);
        }
      }

      return result;
    } catch (err: any) {
      // AnimeThemes is optional enrichment; silent fallback
      return result;
    }
  }
}

export const themesService = new ThemesService();
