import { config } from '../config/index.js';

class AniListService {
  private lastRequestTime = 0;
  private minGapMs = 700; // Throttle to stay safely within 90 req/min limit

  private async fetchGraphQL(query: string, variables: Record<string, any> = {}): Promise<any | null> {
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
          'User-Agent': 'AniNexus/1.0',
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
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
    const query = `
      query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
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
          description(asHtml: false)
          startDate { year month day }
          endDate { year month day }
          season
          seasonYear
          episodes
          duration
          isAdult
          genres
          averageScore
          meanScore
          popularity
          favourites
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

    const data = await this.fetchGraphQL(query, { idMal: malId });
    return data?.Media || null;
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
}

export const anilistService = new AniListService();
