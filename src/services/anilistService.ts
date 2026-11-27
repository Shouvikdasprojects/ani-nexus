import { config } from '../config/index.js';

class AniListService {
  private lastRequestTime = 0;
  private minGapMs = 850; // Throttle to stay safely within 90 req/min limit

  private async fetchGraphQL(query: string, variables: Record<string, any> = {}, retryCount = 0): Promise<any | null> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minGapMs) {
      await new Promise((r) => setTimeout(r, this.minGapMs - elapsed));
    }
    this.lastRequestTime = Date.now();

    try {
      const res = await fetch(config.anilist.graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 429 && retryCount < 3) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10);
        console.warn(`⏳ [AniList Rate Limiter]: 429 cooldown encountered. Auto-waiting ${retryAfter}s before retry (${retryCount + 1}/3)...`);
        await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
        return this.fetchGraphQL(query, variables, retryCount + 1);
      }

      if (!res.ok) {
        console.warn(`[AniList Service Warning]: HTTP ${res.status} ${res.statusText}`);
        return null;
      }

      const json: any = await res.json();
      return json?.data || null;
    } catch (err: any) {
      console.warn('[AniList Service Error]:', err.message);
      return null;
    }
  }

  async getAnimeByMalId(malId: number): Promise<any | null> {
    return this.getAnimeDetails({ malId });
  }

  async getAnimeDetails(idTarget: { aniId?: number; malId?: number }): Promise<any | null> {
    const query = `
      query ($id: Int, $idMal: Int) {
        Media(id: $id, idMal: $idMal, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          synonyms
          format
          status
          source
          description(asHtml: false)
          startDate { year month day }
          endDate { year month day }
          season
          seasonYear
          episodes
          duration
          isAdult
          genres
          tags {
            name
            rank
            isMediaSpoiler
          }
          averageScore
          meanScore
          popularity
          favourites
          stats {
            scoreDistribution { score amount }
            statusDistribution { status amount }
          }
          recommendations(perPage: 8, sort: [RATING_DESC]) {
            nodes {
              rating
              mediaRecommendation {
                id
                idMal
                type
                title { romaji english userPreferred }
                format
                coverImage { large }
                averageScore
              }
            }
          }
          externalLinks {
            site
            type
            url
            language
          }
          coverImage {
            extraLarge
            large
          }
          bannerImage
          trailer {
            id
            site
            thumbnail
          }
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
          studios {
            edges {
              isMain
              node {
                id
                name
                isAnimationStudio
                siteUrl
                favourites
              }
            }
          }
          staff(perPage: 25, sort: [RELEVANCE]) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  large
                }
                description(asHtml: false)
                primaryOccupations
                gender
                dateOfBirth { year month day }
                dateOfDeath { year month day }
                age
                yearsActive
                homeTown
                bloodType
                siteUrl
                favourites
              }
            }
          }
          characters(perPage: 30, sort: [ROLE, RELEVANCE]) {
            edges {
              role
              node {
                id
                name {
                  full
                  native
                  alternative
                }
                image {
                  large
                }
                gender
                age
                dateOfBirth { year month day }
                bloodType
                description(asHtml: false)
                favourites
                siteUrl
              }
              voiceActorRoles(sort: [RELEVANCE]) {
                voiceActor {
                  id
                  name {
                    full
                    native
                  }
                  languageV2
                  image {
                    large
                  }
                  homeTown
                  dateOfBirth { year month day }
                  description(asHtml: false)
                  siteUrl
                  favourites
                }
              }
            }
          }
          relations {
            edges {
              relationType
              node {
                id
                idMal
                type
                format
                status
                title {
                  romaji
                  english
                  native
                }
                startDate { year }
                episodes
                duration
                coverImage {
                  large
                }
              }
            }
          }
        }
      }
    `;

    const variables: Record<string, any> = {};
    if (idTarget.aniId) variables.id = idTarget.aniId;
    if (idTarget.malId) variables.idMal = idTarget.malId;
    const data = await this.fetchGraphQL(query, variables);
    return data?.Media || null;
  }

  async getMediaReviews(aniId: number, perPage: number = 10): Promise<any[]> {
    const query = `
      query ($id: Int, $perPage: Int) {
        Media(id: $id) {
          reviews(perPage: $perPage, sort: [RATING_DESC]) {
            nodes {
              id
              score
              rating
              summary
              body(asHtml: false)
              createdAt
              user {
                name
                avatar { medium }
              }
            }
          }
        }
      }
    `;
    const data = await this.fetchGraphQL(query, { id: aniId, perPage });
    const nodes = data?.Media?.reviews?.nodes || [];
    return nodes.map((r: any) => ({
      id: String(r.id),
      username: r.user?.name || 'Community Reviewer',
      avatar: r.user?.avatar?.medium || undefined,
      score: r.score ? Math.round((r.score / 10) * 10) / 10 : 8,
      summary: r.summary || '',
      body: r.body || '',
      createdAt: r.createdAt ? new Date(r.createdAt * 1000).toISOString() : new Date().toISOString(),
      helpfulCount: r.rating || 0,
      recommendationType: r.score >= 70 ? 'RECOMMENDED' : r.score >= 50 ? 'MIXED' : 'NOT_RECOMMENDED',
    }));
  }

  async getAiringSchedule(start: number, end: number): Promise<any[]> {
    let allSchedules: any[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage && page <= 4) {
      const query = `
        query ($start: Int, $end: Int, $page: Int) {
          Page(page: $page, perPage: 50) {
            pageInfo {
              hasNextPage
            }
            airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
              id
              airingAt
              timeUntilAiring
              episode
              media {
                id
                idMal
                title {
                  romaji
                  english
                  native
                  userPreferred
                }
                coverImage {
                  large
                  extraLarge
                }
                bannerImage
                format
                status
                episodes
                duration
                countryOfOrigin
                genres
                averageScore
                popularity
                description(asHtml: false)
                studios(isMain: true) {
                  nodes {
                    id
                    name
                    isAnimationStudio
                    siteUrl
                  }
                }
                externalLinks {
                  site
                  url
                }
              }
            }
          }
        }
      `;

      const data = await this.fetchGraphQL(query, { start, end, page });
      const schedules = data?.Page?.airingSchedules || [];
      allSchedules = allSchedules.concat(schedules);
      hasNextPage = Boolean(data?.Page?.pageInfo?.hasNextPage) && schedules.length > 0;
      page++;
    }

    return allSchedules;
  }

  async getSeasonalAnime(
    year: number,
    season: string,
    page: number = 1,
    perPage: number = 50,
    format?: string
  ): Promise<{ total: number; page: number; hasNextPage: boolean; media: any[] }> {
    const query = `
      query ($year: Int, $season: MediaSeason, $page: Int, $perPage: Int, $format: MediaFormat) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            hasNextPage
          }
          media(season: $season, seasonYear: $year, type: ANIME, format: $format, sort: [POPULARITY_DESC]) {
            id
            idMal
            title {
              romaji
              english
              native
              userPreferred
            }
            coverImage {
              large
              extraLarge
            }
            bannerImage
            format
            status
            episodes
            duration
            countryOfOrigin
            source
            genres
            averageScore
            meanScore
            popularity
            favourites
            description(asHtml: false)
            startDate {
              year
              month
              day
            }
            studios(isMain: true) {
              nodes {
                id
                name
                isAnimationStudio
                siteUrl
              }
            }
            nextAiringEpisode {
              airingAt
              timeUntilAiring
              episode
            }
            trailer {
              id
              site
              thumbnail
            }
            externalLinks {
              site
              url
            }
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      year,
      season: season.toUpperCase(),
      page,
      perPage,
    };
    if (format) {
      variables.format = format.toUpperCase();
    }

    const data = await this.fetchGraphQL(query, variables);
    return {
      total: data?.Page?.pageInfo?.total || 0,
      page: data?.Page?.pageInfo?.currentPage || page,
      hasNextPage: Boolean(data?.Page?.pageInfo?.hasNextPage),
      media: data?.Page?.media || [],
    };
  }

  async searchAnime(search: string): Promise<any[]> {
    const query = `
      query ($search: String) {
        Page(page: 1, perPage: 5) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            idMal
            title {
              romaji
              english
              userPreferred
            }
            format
            seasonYear
          }
        }
      }
    `;

    const data = await this.fetchGraphQL(query, { search });
    return data?.Page?.media || [];
  }

  private readonly MANGA_DETAILS_FIELDS = `
  id
  idMal
  title {
    romaji
    english
    native
    userPreferred
  }
  synonyms
  format
  countryOfOrigin
  status
  description(asHtml: false)
  startDate { year month day }
  endDate { year month day }
  chapters
  volumes
  isAdult
  genres
  tags {
    name
    rank
  }
  averageScore
  meanScore
  popularity
  favourites
  stats {
    scoreDistribution { score amount }
    statusDistribution { status amount }
  }
  recommendations(perPage: 8, sort: [RATING_DESC]) {
    nodes {
      rating
      mediaRecommendation {
        id
        idMal
        type
        title { romaji english userPreferred }
        format
        coverImage { large }
        averageScore
      }
    }
  }
  externalLinks {
    site
    type
    url
  }
  coverImage {
    extraLarge
    large
  }
  bannerImage
  staff(perPage: 12) {
    edges {
      role
      node {
        id
        name { full native }
        image { large }
      }
    }
  }
  characters(perPage: 15, sort: [ROLE, RELEVANCE]) {
    edges {
      role
      node {
        id
        name { full native }
        image { large }
      }
    }
  }
  relations {
    edges {
      relationType
      node {
        id
        idMal
        type
        format
        status
        title { romaji english userPreferred }
        coverImage { large }
      }
    }
  }
`;

  async getMangaDetails(idOrMalId: { aniId?: number; malId?: number }): Promise<any | null> {
    const query = `
      query ($id: Int, $idMal: Int) {
        Media(id: $id, idMal: $idMal, type: MANGA) {
          ${this.MANGA_DETAILS_FIELDS}
        }
      }
    `;

    const variables: Record<string, any> = {};
    if (idOrMalId.aniId) variables.id = idOrMalId.aniId;
    if (idOrMalId.malId) variables.idMal = idOrMalId.malId;

    const data = await this.fetchGraphQL(query, variables);
    return data?.Media || null;
  }

  async getTopManga(
    page: number = 1,
    perPage: number = 50,
    sort: string[] = ['POPULARITY_DESC'],
    filters?: { countryOfOrigin?: string; format?: string }
  ): Promise<any[]> {
    const query = `
      query ($page: Int, $perPage: Int, $sort: [MediaSort], $countryOfOrigin: CountryCode, $format: MediaFormat) {
        Page(page: $page, perPage: $perPage) {
          media(type: MANGA, sort: $sort, countryOfOrigin: $countryOfOrigin, format: $format) {
            id
            idMal
            title { romaji english native userPreferred }
            format
            countryOfOrigin
            status
            chapters
            volumes
            averageScore
            popularity
            coverImage { large }
          }
        }
      }
    `;

    const variables: Record<string, any> = { page, perPage, sort };
    if (filters?.countryOfOrigin) variables.countryOfOrigin = filters.countryOfOrigin;
    if (filters?.format) variables.format = filters.format;

    const data = await this.fetchGraphQL(query, variables);
    return data?.Page?.media || [];
  }

  async getMangaByYear(year: number, page: number = 1, perPage: number = 50, fullDetails: boolean = false): Promise<any[]> {
    const fields = fullDetails
      ? this.MANGA_DETAILS_FIELDS
      : `
            id
            idMal
            title { romaji english native userPreferred }
            format
            countryOfOrigin
            status
            chapters
            volumes
            averageScore
            popularity
            coverImage { large }`;
    const query = `
      query ($page: Int, $perPage: Int, $greater: FuzzyDateInt, $lesser: FuzzyDateInt) {
        Page(page: $page, perPage: $perPage) {
          media(type: MANGA, startDate_greater: $greater, startDate_lesser: $lesser, sort: [POPULARITY_DESC]) {
            ${fields}
          }
        }
      }
    `;

    const variables = {
      page,
      perPage,
      greater: year * 10000,
      lesser: year * 10000 + 1231,
    };

    const data = await this.fetchGraphQL(query, variables);
    return data?.Page?.media || [];
  }
}

export const anilistService = new AniListService();
