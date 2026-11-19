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
          studios(isMain: true) {
            nodes { name }
          }
          characters(perPage: 25, sort: [ROLE, RELEVANCE]) {
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

  async getAiringSchedule(start: number, end: number, page: number = 1): Promise<any[]> {
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
              }
              coverImage {
                large
              }
              bannerImage
              format
              genres
              averageScore
            }
          }
        }
      }
    `;

    const data = await this.fetchGraphQL(query, { start, end, page });
    return data?.Page?.airingSchedules || [];
  }
}

export const anilistService = new AniListService();
