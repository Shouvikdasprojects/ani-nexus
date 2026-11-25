import { getMangaModel, getTargetMangaWriteModel, getAllMangaModels } from '../config/database.js';
import { IManga, IMangaAdaptation, IMangaCreator, IMangaGenre, IMangaCharacterRef } from '../models/Manga.js';
import { anilistService } from './anilistService.js';
import { malService } from './malService.js';
import { findOneAcrossVaults } from '../utils/vaultQuery.js';

class MangaBuilder {
  public slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private determineType(aniMedia: any, malData: any): 'MANGA' | 'MANHWA' | 'MANHUA' | 'LIGHT_NOVEL' | 'WEB_NOVEL' | 'ONE_SHOT' | 'DOUJINSHI' {
    const country = (aniMedia?.countryOfOrigin || '').toUpperCase();
    const format = (aniMedia?.format || malData?.media_type || '').toUpperCase();

    if (country === 'KR') return 'MANHWA';
    if (country === 'CN' || country === 'TW') return 'MANHUA';
    if (format === 'NOVEL' || format === 'LIGHT_NOVEL') return 'LIGHT_NOVEL';
    if (format === 'ONE_SHOT') return 'ONE_SHOT';
    if (format === 'DOUJINSHI') return 'DOUJINSHI';
    return 'MANGA';
  }

  private determineReadingDirection(type: string): 'right-to-left' | 'top-to-bottom' | 'left-to-right' {
    if (type === 'MANHWA' || type === 'MANHUA') return 'top-to-bottom';
    if (type === 'LIGHT_NOVEL' || type === 'WEB_NOVEL') return 'left-to-right';
    return 'right-to-left';
  }

  public async buildAndSaveManga(idTarget: { aniId?: number; malId?: number }): Promise<IManga | null> {
    const PrimaryMangaModel = getMangaModel();
    const TargetModel = await getTargetMangaWriteModel();

    // 1. Fetch details from AniList
    const aniMedia = await anilistService.getMangaDetails(idTarget);
    const resolvedMalId = idTarget.malId || aniMedia?.idMal;

    // 2. Fetch details from MAL if available
    let malData: any = null;
    if (resolvedMalId) {
      malData = await malService.getMangaDetails(resolvedMalId);
    }

    if (!aniMedia && !malData) {
      return null;
    }

    // 3. Resolve Titles & Slug
    const primaryTitle =
      aniMedia?.title?.english ||
      aniMedia?.title?.romaji ||
      malData?.title ||
      aniMedia?.title?.userPreferred ||
      'Unknown Manga';

    const baseSlug = this.slugify(primaryTitle);
    let slug = baseSlug || `manga-${idTarget.aniId || idTarget.malId || Date.now()}`;

    // Prevent slug collisions across different titles in both Vault 2 & Vault 2B
    const existingWithSlug = await findOneAcrossVaults(getAllMangaModels(), { slug }, { ids: 1 });
    if (
      existingWithSlug &&
      existingWithSlug.ids?.aniId &&
      existingWithSlug.ids.aniId !== (idTarget.aniId || aniMedia?.id)
    ) {
      slug = `${slug}-${idTarget.aniId || idTarget.malId || Date.now()}`;
    }

    // 4. Resolve Type & Reading Direction
    const type = this.determineType(aniMedia, malData);
    const readingDirection = this.determineReadingDirection(type);

    // 5. Calculate Dual Scores
    const aniScore = aniMedia?.averageScore ? aniMedia.averageScore / 10 : null; // normalize 0-100 to 0-10
    const malScore = malData?.mean || null;

    let weightedAverage = 8.0;
    if (aniScore && malScore) {
      weightedAverage = Number(((aniScore * 0.5) + (malScore * 0.5)).toFixed(2));
    } else if (aniScore) {
      weightedAverage = Number(aniScore.toFixed(2));
    } else if (malScore) {
      weightedAverage = Number(malScore.toFixed(2));
    }

    // 6. Extract Creators (Story, Art)
    const creators: IMangaCreator[] = [];
    if (aniMedia?.staff?.edges && Array.isArray(aniMedia.staff.edges)) {
      for (const edge of aniMedia.staff.edges) {
        if (edge.node?.name?.full) {
          creators.push({
            id: edge.node.id,
            name: edge.node.name.full,
            role: edge.role || 'Story & Art',
          });
        }
      }
    }
    if (creators.length === 0 && malData?.authors && Array.isArray(malData.authors)) {
      for (const a of malData.authors) {
        creators.push({
          id: a.node?.id,
          name: `${a.node?.first_name || ''} ${a.node?.last_name || ''}`.trim(),
          role: a.role || 'Story & Art',
        });
      }
    }

    // 7. Extract Characters
    const characters: IMangaCharacterRef[] = [];
    if (aniMedia?.characters?.edges && Array.isArray(aniMedia.characters.edges)) {
      for (const edge of aniMedia.characters.edges) {
        if (edge.node?.name?.full) {
          characters.push({
            characterId: edge.node.id,
            name: edge.node.name.full,
            role: edge.role || 'Supporting',
            image: edge.node.image?.large,
          });
        }
      }
    }

    // 8. Extract Cross-Media Adaptations (Anime & Related Manga)
    const adaptations: IMangaAdaptation[] = [];
    if (aniMedia?.relations?.edges && Array.isArray(aniMedia.relations.edges)) {
      for (const edge of aniMedia.relations.edges) {
        const node = edge.node;
        if (!node) continue;
        adaptations.push({
          relationType: edge.relationType || 'ADAPTATION',
          type: node.type === 'ANIME' ? 'ANIME' : 'MANGA',
          title: node.title?.english || node.title?.romaji || node.title?.userPreferred || 'Related Work',
          id: node.id,
          idMal: node.idMal,
          slug: this.slugify(node.title?.english || node.title?.romaji || `rel-${node.id}`),
          format: node.format,
          status: node.status,
          coverImage: node.coverImage?.large,
        });
      }
    }

    // 9. Genres & Tags
    const genres: IMangaGenre[] = (aniMedia?.genres || malData?.genres?.map((g: any) => g.name) || []).map((g: string) => ({
      name: g,
      slug: this.slugify(g),
      icon: '📖',
    }));

    const tags: Array<{ name: string; rank?: number }> = (aniMedia?.tags || []).map((t: any) => ({
      name: t.name,
      rank: t.rank,
    }));

    // 10. Assemble complete document
    const docData: Partial<IManga> = {
      slug,
      ids: {
        malId: resolvedMalId,
        aniId: aniMedia?.id,
      },
      type,
      countryOfOrigin: aniMedia?.countryOfOrigin || 'JP',
      format: aniMedia?.format || 'MANGA',
      readingDirection,
      titles: {
        primary: primaryTitle,
        english: aniMedia?.title?.english || malData?.alternative_titles?.en,
        romaji: aniMedia?.title?.romaji || malData?.title,
        native: aniMedia?.title?.native || malData?.alternative_titles?.ja,
        synonyms: Array.from(new Set([
          ...(aniMedia?.synonyms || []),
          ...(malData?.alternative_titles?.synonyms || []),
        ])),
      },
      status: (aniMedia?.status || malData?.status || 'FINISHED').toUpperCase() as any,
      chapters: aniMedia?.chapters || malData?.num_chapters || 0,
      volumes: aniMedia?.volumes || malData?.num_volumes || 0,
      releaseYear: aniMedia?.startDate?.year || (malData?.start_date ? parseInt(malData.start_date.slice(0, 4), 10) : undefined),
      endYear: aniMedia?.endDate?.year || (malData?.end_date ? parseInt(malData.end_date.slice(0, 4), 10) : undefined),
      startDate: aniMedia?.startDate,
      endDate: aniMedia?.endDate,
      synopsis: aniMedia?.description || malData?.synopsis || 'No synopsis available.',
      images: {
        cover: aniMedia?.coverImage?.extraLarge || aniMedia?.coverImage?.large || malData?.main_picture?.large || malData?.main_picture?.medium || '',
        banner: aniMedia?.bannerImage,
      },
      genres,
      tags,
      demographic: 'Shounen',
      creators,
      publishers: malData?.serialization?.map((s: any) => s.name) || [],
      scores: {
        weightedAverage,
        dualCommunity: {
          primary: aniScore || undefined,
          secondary: malScore || undefined,
        },
        popularity: aniMedia?.popularity || malData?.popularity || 0,
        favorites: aniMedia?.favourites || 0,
        rank: malData?.rank,
      },
      adaptations,
      characters,
      licensing: {
        publishers: malData?.serialization?.map((s: any) => s.name) || [],
      },
      isAdult: Boolean(aniMedia?.isAdult),
    };

    // 11. Upsert into Target Reading Vault (Vault 2 or Vault 2B spillover)
    const savedDoc = await TargetModel.findOneAndUpdate(
      { slug },
      { $set: docData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (TargetModel !== PrimaryMangaModel) {
      await PrimaryMangaModel.deleteOne({ slug }).catch(() => {});
    }

    return savedDoc;
  }
}

export const mangaBuilder = new MangaBuilder();
