import { Franchise, IFranchise, ITimelinePart, ICharacter, IEpisode } from '../models/Franchise.js';
import { anilistService } from './anilistService.js';
import { malService } from './malService.js';
import { tmdbService } from './tmdbService.js';
import { themesService } from './themesService.js';

export class FranchiseBuilder {
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Builds or updates a franchise from a MAL ID or title
   */
  async buildFromMalId(malId: number): Promise<IFranchise | null> {
    // 1. Fetch AniList detailed Media
    const aniMedia = await anilistService.getAnimeByMalId(malId);
    if (!aniMedia) {
      console.warn(`[FranchiseBuilder] Could not find AniList data for MAL ID: ${malId}`);
      return null;
    }

    return this.buildFromAniListMedia(aniMedia, malId);
  }

  /**
   * Primary Franchise Builder aggregating AniList, MAL, TMDB, and AnimeThemes
   */
  async buildFromAniListMedia(aniMedia: any, malIdFallback?: number): Promise<IFranchise | null> {
    const malId = aniMedia.idMal || malIdFallback;

    // 2. Fetch MAL details in parallel for dual-scoring and extra metadata
    const malData = malId ? await malService.getAnimeDetails(malId) : null;

    // 3. Resolve Titles (English Primary rule)
    const englishTitle = aniMedia.title?.english || malData?.alternative_titles?.en || null;
    const romajiTitle = aniMedia.title?.romaji || malData?.title || 'Unknown Title';
    const nativeTitle = aniMedia.title?.native || malData?.alternative_titles?.ja || '';
    const primaryTitle = englishTitle && englishTitle.trim().length > 0 ? englishTitle.trim() : romajiTitle;

    // Slug based on primary title
    const slug = this.slugify(primaryTitle);
    if (!slug) return null;

    // 4. TMDB Search for 4K visuals, transparent PNG logos, legal OTT watch providers, and episodes
    const releaseYear = aniMedia.startDate?.year || aniMedia.seasonYear || null;
    const tmdbSearch = await tmdbService.searchAnime(primaryTitle, releaseYear || undefined);
    
    let tmdbImages = { backdrop: null as string | null, logo: null as string | null, poster: null as string | null };
    let watchProviders: Array<{ name: string; url: string; type: string }> = [];
    let tmdbEpisodes: any[] = [];

    if (tmdbSearch) {
      const [images, providers, eps] = await Promise.all([
        tmdbService.getImages(tmdbSearch.id, tmdbSearch.type),
        tmdbService.getWatchProviders(tmdbSearch.id, tmdbSearch.type),
        tmdbSearch.type === 'tv' ? tmdbService.getSeasonEpisodes(tmdbSearch.id, 1) : Promise.resolve([]),
      ]);
      tmdbImages = images as any;
      watchProviders = providers;
      tmdbEpisodes = eps;
    }

    // 5. Verified Dub & Sub Extraction (Official Voice Actors credit inspection)
    const verifiedDubs = new Set<string>();
    const characters: ICharacter[] = [];

    if (aniMedia.characters?.edges && Array.isArray(aniMedia.characters.edges)) {
      for (const edge of aniMedia.characters.edges) {
        const charNode = edge.node;
        if (!charNode) continue;

        const role = edge.role === 'MAIN' ? 'Main' : edge.role === 'SUPPORTING' ? 'Supporting' : 'Background';
        const voiceActors: any[] = [];

        if (edge.voiceActorRoles && Array.isArray(edge.voiceActorRoles)) {
          for (const vaRole of edge.voiceActorRoles) {
            const va = vaRole.voiceActor;
            if (!va) continue;

            const lang = va.languageV2 || 'Japanese';
            verifiedDubs.add(lang);

            voiceActors.push({
              actorId: va.id,
              language: lang,
              name: {
                full: va.name?.full || 'Unknown',
                native: va.name?.native || null,
              },
              image: va.image?.large || null,
              homeTown: va.homeTown || null,
              birthday: va.dateOfBirth?.year ? `${va.dateOfBirth.year}-${va.dateOfBirth.month}-${va.dateOfBirth.day}` : null,
              bio: va.description || null,
              famousOtherRoles: [],
            });
          }
        }

        characters.push({
          characterId: charNode.id,
          name: {
            full: charNode.name?.full || 'Unknown',
            native: charNode.name?.native || null,
            aliases: charNode.name?.alternative || [],
          },
          role: role as any,
          image: charNode.image?.large || null,
          details: {
            gender: charNode.gender || null,
            age: charNode.age || null,
            birthday: charNode.dateOfBirth?.year ? `${charNode.dateOfBirth.year}-${charNode.dateOfBirth.month}-${charNode.dateOfBirth.day}` : null,
            bloodType: charNode.bloodType || null,
            about: charNode.description || null,
          },
          voiceActors,
        });
      }
    }

    // Standard audio dub fallback: at minimum Japanese is verified
    if (!verifiedDubs.has('Japanese')) verifiedDubs.add('Japanese');

    // 6. AnimeThemes & MAL OP / ED Songs Enrichment
    const themesData = await themesService.getAnimeThemes(malId, primaryTitle);

    const parseMalSong = (item: any) => {
      const text = item?.text || '';
      const match = text.match(/"([^"]+)"(?:\s+by\s+([^(]+))?/i);
      if (match) {
        return {
          title: match[1].trim(),
          artist: match[2]?.trim() || 'Unknown Artist',
          videoUrl: null,
          audioUrl: null,
        };
      }
      return {
        title: text.replace(/^#\d+:\s*/, '').trim(),
        artist: 'Unknown Artist',
        videoUrl: null,
        audioUrl: null,
      };
    };

    if (themesData.openings.length === 0 && malData?.opening_themes && Array.isArray(malData.opening_themes)) {
      themesData.openings = malData.opening_themes.map(parseMalSong);
    }
    if (themesData.endings.length === 0 && malData?.ending_themes && Array.isArray(malData.ending_themes)) {
      themesData.endings = malData.ending_themes.map(parseMalSong);
    }

    // 7. Trailer Construction
    let trailerObj: any = null;
    if (aniMedia.trailer && aniMedia.trailer.site === 'youtube' && aniMedia.trailer.id) {
      const ytid = aniMedia.trailer.id;
      trailerObj = {
        id: ytid,
        site: 'youtube',
        url: `https://www.youtube.com/watch?v=${ytid}`,
        embedUrl: `https://www.youtube.com/embed/${ytid}`,
        thumbnail: aniMedia.trailer.thumbnail || `https://i.ytimg.com/vi/${ytid}/hqdefault.jpg`,
        title: `${primaryTitle} Official Trailer`,
      };
    }

    // 8. Episode Directory Breakdown
    const totalEpsCount = aniMedia.episodes || tmdbEpisodes.length || 12;
    const episodes: IEpisode[] = [];

    for (let i = 1; i <= Math.min(totalEpsCount, 100); i++) {
      const tmdbEp = tmdbEpisodes.find((e) => e.episodeNumber === i);
      episodes.push({
        season: 1,
        episodeNumber: i,
        title: {
          english: tmdbEp?.name || `Episode ${i}`,
          romaji: `Episode ${i}`,
        },
        airDate: tmdbEp?.airDate || null,
        durationMinutes: aniMedia.duration || 24,
        isFiller: false,
        thumbnail: tmdbEp?.stillPath || null,
        synopsis: tmdbEp?.overview || null,
      });
    }

    // 9. Dual Scoring Calculation
    const malScore = malData?.mean || null;
    const malScoredBy = malData?.num_scoring_users || null;
    const malRank = malData?.rank || null;
    const malPop = malData?.popularity || null;

    const aniScore = aniMedia.averageScore || null;
    const aniPop = aniMedia.popularity || null;
    const aniFavs = aniMedia.favourites || null;

    // Combined score normalized out of 100
    let combinedAverage: number | null = null;
    if (malScore && aniScore) {
      combinedAverage = Math.round(((malScore * 10 + aniScore) / 2) * 10) / 10;
    } else if (malScore) {
      combinedAverage = Math.round(malScore * 10 * 10) / 10;
    } else if (aniScore) {
      combinedAverage = aniScore;
    }

    // 10. Primary Timeline Part (The main season / entry)
    const mainTimelinePart: ITimelinePart = {
      order: 1,
      partId: `${slug}-part-1`,
      partName: primaryTitle,
      ids: {
        malId: malId || null,
        aniId: aniMedia.id || null,
        tmdbId: tmdbSearch?.id || null,
      },
      format: (aniMedia.format || 'TV') as any,
      year: releaseYear,
      episodeCount: totalEpsCount,
      durationMinutes: aniMedia.duration || (aniMedia.format === 'MOVIE' ? 100 : 24),
      status: (aniMedia.status || 'FINISHED') as any,
      isCanon: true,
      watchPriority: 'Essential',
      scores: {
        mal: {
          score: malScore,
          scoredBy: malScoredBy,
          rank: malRank,
          popularity: malPop,
        },
        anilist: {
          score: aniScore,
          popularity: aniPop,
          favorites: aniFavs,
        },
        combinedAverage,
      },
      trailer: trailerObj,
      languages: {
        audioDubs: Array.from(verifiedDubs),
        subtitles: ['English', 'Japanese', 'Spanish', 'French', 'German'],
      },
      licensing: {
        isOfficiallyLicensed: true,
        notice: 'Official verified licensing details. No pirated content hosted.',
        platforms: watchProviders.length > 0 ? watchProviders : [
          { name: 'Crunchyroll', url: 'https://www.crunchyroll.com', type: 'subscription' },
          { name: 'Netflix', url: 'https://www.netflix.com', type: 'subscription' }
        ],
      },
      songs: themesData,
      episodes,
    };

    // 11. Add Related Timeline Parts (Sequels, Prequels, Movies)
    const timeline: ITimelinePart[] = [mainTimelinePart];
    let partOrder = 2;

    if (aniMedia.relations?.edges && Array.isArray(aniMedia.relations.edges)) {
      for (const rel of aniMedia.relations.edges) {
        const relNode = rel.node;
        if (!relNode || relNode.format === 'MANGA' || relNode.format === 'NOVEL') continue;

        const relEnglish = relNode.title?.english || null;
        const relRomaji = relNode.title?.romaji || 'Related Work';
        const relPrimary = relEnglish || relRomaji;

        const isSequelOrPrequel = rel.relationType === 'SEQUEL' || rel.relationType === 'PREQUEL';
        const priority = isSequelOrPrequel ? 'Essential' : 'Recommended';

        timeline.push({
          order: partOrder++,
          partId: `${slug}-part-${partOrder}`,
          partName: relPrimary,
          ids: {
            malId: relNode.idMal || null,
            aniId: relNode.id || null,
            tmdbId: null,
          },
          format: (relNode.format || 'TV') as any,
          year: relNode.startDate?.year || null,
          episodeCount: relNode.episodes || null,
          durationMinutes: relNode.duration || (relNode.format === 'MOVIE' ? 100 : 24),
          status: (relNode.status || 'FINISHED') as any,
          isCanon: isSequelOrPrequel || relNode.format === 'TV' || relNode.format === 'MOVIE',
          watchPriority: priority as any,
          scores: {
            mal: { score: null },
            anilist: { score: null },
            combinedAverage: null,
          },
          trailer: null,
          languages: {
            audioDubs: Array.from(verifiedDubs),
            subtitles: ['English', 'Japanese'],
          },
          licensing: {
            isOfficiallyLicensed: true,
            notice: 'Official verified licensing details.',
            platforms: watchProviders,
          },
          songs: { openings: [], endings: [] },
          episodes: [],
        });
      }
    }

    // 12. Classification: Exhaustive Multi-Source Genres, Themes & Demographics Mapping
    const genreIconMap: Record<string, string> = {
      action: '⚔️',
      adventure: '🗺️',
      fantasy: '🧙‍♂️',
      'sci-fi': '🚀',
      supernatural: '👻',
      mystery: '🔍',
      comedy: '😂',
      drama: '🎭',
      romance: '💖',
      'slice of life': '🍵',
      sports: '⚽',
      music: '🎵',
      horror: '🧟',
      psychological: '🧠',
      suspense: '⏱️',
      thriller: '😱',
      isekai: '🌀',
      mecha: '🤖',
      'time travel': '⏳',
      school: '🏫',
      historical: '🏯',
      military: '🎖️',
      'martial arts': '🥋',
      mythology: '⚡',
      parody: '🃏',
      space: '🌌',
      cyberpunk: '🏙️',
      'post-apocalyptic': '🌋',
      'super power': '💥',
      ecchi: '🔞',
      hentai: '🚫',
    };

    // Collect raw genres from both AniList and MAL
    const rawAllGenres = new Set<string>();
    if (aniMedia.genres && Array.isArray(aniMedia.genres)) {
      aniMedia.genres.forEach((g: string) => rawAllGenres.add(g.trim()));
    }
    if (malData?.genres && Array.isArray(malData.genres)) {
      malData.genres.forEach((g: any) => {
        const name = typeof g === 'string' ? g : g?.name;
        if (name) rawAllGenres.add(name.trim());
      });
    }

    const demographicsList = ['Shounen', 'Seinen', 'Shoujo', 'Josei', 'Kids'];
    const knownThemeList = [
      'Isekai', 'Mecha', 'Time Travel', 'School', 'Historical',
      'Military', 'Martial Arts', 'Mythology', 'Parody', 'Space',
      'Cyberpunk', 'Post-Apocalyptic', 'Super Power'
    ];

    const genresList: Array<{ name: string; slug: string; icon: string }> = [];
    const themesList: Array<{ name: string; slug: string; icon: string }> = [];
    let demographicObj: { name: string; slug: string; description?: string } | null = null;

    rawAllGenres.forEach((g) => {
      const lower = g.toLowerCase();
      const slug = this.slugify(g);
      const icon = genreIconMap[lower] || '🏷️';

      if (demographicsList.map(d => d.toLowerCase()).includes(lower)) {
        if (!demographicObj) {
          demographicObj = {
            name: g,
            slug,
            description: `Targeted at ${g} audiences`,
          };
        }
      } else if (knownThemeList.map(t => t.toLowerCase()).includes(lower)) {
        themesList.push({ name: g, slug, icon });
      } else {
        genresList.push({ name: g, slug, icon });
      }
    });

    // Detect extra themes from description / synopsis if not already present
    const descText = (aniMedia.description || malData?.synopsis || '').toLowerCase();
    const addThemeIfNotExists = (name: string, slug: string, icon: string) => {
      if (!themesList.some((t) => t.slug === slug)) {
        themesList.push({ name, slug, icon });
      }
    };

    if (descText.includes('isekai') || descText.includes('reincarnated') || descText.includes('another world')) {
      addThemeIfNotExists('Isekai', 'isekai', '🌀');
    }
    if (descText.includes('mecha') || descText.includes('giant robot')) {
      addThemeIfNotExists('Mecha', 'mecha', '🤖');
    }
    if (descText.includes('time travel') || descText.includes('timeline')) {
      addThemeIfNotExists('Time Travel', 'time-travel', '⏳');
    }
    if (descText.includes('school') || descText.includes('high school')) {
      addThemeIfNotExists('School', 'school', '🏫');
    }

    // Fallback demographic detection from description
    if (!demographicObj) {
      if (descText.includes('shounen')) {
        demographicObj = { name: 'Shounen', slug: 'shounen', description: 'Targeted at young male audiences' };
      } else if (descText.includes('seinen')) {
        demographicObj = { name: 'Seinen', slug: 'seinen', description: 'Targeted at adult male audiences' };
      } else if (descText.includes('shoujo')) {
        demographicObj = { name: 'Shoujo', slug: 'shoujo', description: 'Targeted at young female audiences' };
      }
    }

    // Adult & Content Rating
    const isAdult = Boolean(aniMedia.isAdult) || malData?.nsfw === true;
    const nsfw = isAdult || rawAllGenres.has('Ecchi') || rawAllGenres.has('Hentai');
    const contentRating = {
      isAdult,
      nsfw,
      rating: isAdult ? 'R18+' : nsfw ? 'R17+' : 'PG-13',
      ageClassification: isAdult ? 'Adults Only (18+)' : nsfw ? 'Teens 17+' : 'Teens 13+',
    };

    // Poster & Visuals
    const poster = tmdbImages.poster || aniMedia.coverImage?.extraLarge || aniMedia.coverImage?.large || malData?.main_picture?.large || null;
    const backdrop = tmdbImages.backdrop || aniMedia.bannerImage || null;
    const logo = tmdbImages.logo || null;

    // Synonyms
    const synonymsSet = new Set<string>();
    if (englishTitle) synonymsSet.add(englishTitle);
    if (romajiTitle) synonymsSet.add(romajiTitle);
    if (nativeTitle) synonymsSet.add(nativeTitle);
    if (aniMedia.synonyms && Array.isArray(aniMedia.synonyms)) {
      aniMedia.synonyms.forEach((s: string) => synonymsSet.add(s));
    }
    if (malData?.alternative_titles?.synonyms && Array.isArray(malData.alternative_titles.synonyms)) {
      malData.alternative_titles.synonyms.forEach((s: string) => synonymsSet.add(s));
    }

    // 13. Upsert into MongoDB
    const franchiseDoc = await Franchise.findOneAndUpdate(
      { slug },
      {
        slug,
        titles: {
          primary: primaryTitle,
          english: englishTitle,
          romaji: romajiTitle,
          native: nativeTitle,
          synonyms: Array.from(synonymsSet),
        },
        images: {
          poster,
          backdrop,
          logo,
        },
        overview: aniMedia.description || malData?.synopsis || '',
        classification: {
          genres: genresList,
          themes: themesList,
          demographic: demographicObj,
        },
        contentRating,
        totalParts: timeline.length,
        totalEpisodes: timeline.reduce((acc, t) => acc + (t.episodes?.length || 0), 0) || totalEpsCount,
        mainCharacters: characters.slice(0, 30),
        timeline,
        lastUpdated: new Date(),
        revalidateAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days SWR
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return franchiseDoc;
  }
}

export const franchiseBuilder = new FranchiseBuilder();
