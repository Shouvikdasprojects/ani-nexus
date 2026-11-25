/**
 * OpenAPI 3.1.0 Specification for AniNexus Anime Intelligence API
 * Official specification for client SDK generation, Swagger UI, Scalar, Insomnia, and Postman.
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'AniNexus API',
    version: '1.0.0',
    description:
      'Enterprise-grade Anime Metadata & Intelligence API. Unified Master Franchises, verified Indian and international audio dubs, dual community consensus scores, rolling industry awards, and 7-day broadcast schedules.',
    contact: {
      name: 'Shouvik Das',
      url: 'https://aninexus-api-website.pages.dev',
      email: 'shouvikdas155@gmail.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://ani-nexus.onrender.com',
      description: 'Production Global Gateway',
    },
  ],
  tags: [
    { name: 'System', description: 'Gateway telemetry, health diagnostics, and OpenAPI spec' },
    { name: 'Master Franchises', description: 'Unified franchise dossiers, chronological timelines, and episode indexes' },
    { name: 'Anime Entries', description: 'Individual season, movie, and OVA metadata with verified dub tracks' },
    { name: 'Seasonal Hub', description: 'Current broadcast, upcoming previews, and historical seasonal archives' },
    { name: 'Top Collections', description: 'Curated trending, all-time popular, highest rated, and movie rankings' },
    { name: 'Anime Awards', description: '5-year rolling anime industry awards and category winners' },
    { name: 'Broadcast & Media', description: '7-day weekly release schedule and verified YouTube promo trailers' },
    { name: 'News & Articles', description: 'Auto-aggregated anime industry news and deep-dive editorial articles' },
    { name: 'Characters & Staff', description: 'Comprehensive character profiles, seiyuu cast, and voice actor portfolios' },
    { name: 'Print Media (Manga & Novels)', description: 'Manga, Korean Manhwa, Chinese Manhua, Light Novels & MangaDex chapters' },
    { name: 'Discovery & Search', description: 'Multi-factor faceted filtering, genre directory, and global search' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Gateway Health Verification',
        description: 'Returns real-time gateway operational status and uptime.',
        responses: {
          '200': {
            description: 'Gateway is operational and healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', example: '2026-11-22T08:15:00.000Z' },
                    uptime: { type: 'number', example: 4210.5 },
                    requestId: { type: 'string', example: 'req_8f19c210b' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health/detailed': {
      get: {
        tags: ['System'],
        summary: 'Detailed Health & Telemetry Diagnostics',
        description: 'Returns real-time connectivity status of database vaults, system memory, and rate limit metrics.',
        responses: {
          '200': {
            description: 'Detailed diagnostic data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    uptime: { type: 'number', example: 4210.5 },
                    timestamp: { type: 'string', example: '2026-11-22T08:15:00.000Z' },
                    requestId: { type: 'string', example: 'req_8f19c210b' },
                    vaults: {
                      type: 'object',
                      properties: {
                        vault1Primary: { type: 'string', example: 'connected' },
                        vault1bOverflow: { type: 'string', example: 'connected' },
                        vault2Reading: { type: 'string', example: 'connected' },
                        vault2bOverflow: { type: 'string', example: 'connected' },
                        vault3Realtime: { type: 'string', example: 'connected' },
                      },
                    },
                    system: {
                      type: 'object',
                      properties: {
                        memoryMB: { type: 'number', example: 94.2 },
                        heapUsedMB: { type: 'number', example: 58.1 },
                        nodeVersion: { type: 'string', example: 'v20.18.0' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/series/{slug}': {
      get: {
        tags: ['Master Franchises'],
        summary: 'Fetch Master Franchise Dossier',
        description: 'Returns a complete master anime franchise containing all seasons, movies, OVAs, scores, and OTT legal streams.',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            description: 'URL-friendly franchise identifier (e.g., attack-on-titan, naruto, death-note)',
            schema: { type: 'string', example: 'attack-on-titan' },
          },
        ],
        responses: {
          '200': { description: 'Master franchise retrieved successfully' },
          '404': { description: 'Franchise not found' },
          '429': { description: 'Rate limit exceeded (90 req/min)' },
        },
      },
    },
    '/api/v1/series/{slug}/timeline': {
      get: {
        tags: ['Master Franchises'],
        summary: 'Franchise Watch Order & Timeline',
        description: 'Returns chronological and release watch orders, marking canon vs non-canon entries and watch priority.',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'attack-on-titan' },
          },
        ],
        responses: {
          '200': { description: 'Chronological timeline entries' },
        },
      },
    },
    '/api/v1/series/{slug}/episodes': {
      get: {
        tags: ['Master Franchises'],
        summary: 'Unified Episode Catalog',
        description: 'Returns all episodes across all parts, seasons, and OVAs in the franchise.',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'attack-on-titan' },
          },
        ],
        responses: {
          '200': { description: 'Episode listings across the franchise' },
        },
      },
    },
    '/api/v1/series/{slug}/characters': {
      get: {
        tags: ['Master Franchises'],
        summary: 'Franchise Character Cast',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Franchise characters' } },
      },
    },
    '/api/v1/series/{slug}/staff': {
      get: {
        tags: ['Master Franchises'],
        summary: 'Franchise Production Staff',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Franchise directors, animators, and music staff' } },
      },
    },
    '/api/v1/series/{slug}/adaptations': {
      get: {
        tags: ['Master Franchises'],
        summary: 'Source Material & Reading Adaptations',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Matched manga, manhwa, and light novel adaptations' } },
      },
    },
    '/api/v1/anime/{idOrSlug}': {
      get: {
        tags: ['Anime Entries'],
        summary: 'Specific Anime Entry Metadata',
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string', example: '52991' } },
        ],
        responses: { '200': { description: 'Specific entry metadata' } },
      },
    },
    '/api/v1/anime/{idOrSlug}/languages': {
      get: {
        tags: ['Anime Entries'],
        summary: 'Verified Audio Dub & Subtitle Matrix',
        description: 'Returns 100% verified voice actor-derived audio dubs (including Hindi, Tamil, Telugu, English, etc.) and subtitles.',
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string', example: 'attack-on-titan' } },
        ],
        responses: { '200': { description: 'Verified dubs and subtitle languages' } },
      },
    },
    '/api/v1/schedule': {
      get: {
        tags: ['Broadcast & Media'],
        summary: '7-Day Weekly Broadcast Schedule',
        description: 'Returns currently airing anime grouped by day of the week (Monday through Sunday) with exact broadcast times.',
        responses: { '200': { description: 'Weekly release schedule' } },
      },
    },
    '/api/v1/trailers': {
      get: {
        tags: ['Broadcast & Media'],
        summary: 'Verified YouTube Promotional Trailers',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'List of embedded YouTube trailers' } },
      },
    },
    '/api/v1/news': {
      get: {
        tags: ['News & Articles'],
        summary: 'Auto-Aggregated Anime Industry News',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: { '200': { description: 'Latest anime industry news' } },
      },
    },
    '/api/v1/articles': {
      get: {
        tags: ['News & Articles'],
        summary: 'Curated Editorial Anime Articles',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 15 } },
        ],
        responses: { '200': { description: 'Deep-dive editorial journalism' } },
      },
    },
    '/api/v1/genres': {
      get: {
        tags: ['Discovery & Search'],
        summary: 'Master Anime Genres & Themes Directory',
        responses: { '200': { description: '34 curated anime genres and thematic tags' } },
      },
    },
    '/api/v1/filter': {
      get: {
        tags: ['Discovery & Search'],
        summary: 'Multi-Factor Faceted Query Engine',
        parameters: [
          { name: 'genre', in: 'query', schema: { type: 'string', example: 'action' } },
          { name: 'theme', in: 'query', schema: { type: 'string', example: 'isekai' } },
          { name: 'demographic', in: 'query', schema: { type: 'string', example: 'shounen' } },
          { name: 'year', in: 'query', schema: { type: 'integer', example: 2024 } },
          { name: 'format', in: 'query', schema: { type: 'string', example: 'TV' } },
          { name: 'dub', in: 'query', schema: { type: 'string', example: 'Hindi' } },
          { name: 'isAdult', in: 'query', schema: { type: 'boolean', example: false } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['score', 'popularity', 'newest'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: { '200': { description: 'Filtered franchises matching criteria' } },
      },
    },
    '/api/v1/seasons/now': {
      get: {
        tags: ['Seasonal Hub'],
        summary: 'Current Season Airing Titles',
        responses: { '200': { description: 'Currently broadcasted seasonal anime' } },
      },
    },
    '/api/v1/seasons/upcoming': {
      get: {
        tags: ['Seasonal Hub'],
        summary: 'Upcoming Season Preview',
        responses: { '200': { description: 'Next season anime queue' } },
      },
    },
    '/api/v1/seasons/{year}/{season}': {
      get: {
        tags: ['Seasonal Hub'],
        summary: 'Historical Seasonal Archive',
        parameters: [
          { name: 'year', in: 'path', required: true, schema: { type: 'integer', example: 2024 } },
          { name: 'season', in: 'path', required: true, schema: { type: 'string', enum: ['winter', 'spring', 'summer', 'fall'], example: 'fall' } },
        ],
        responses: { '200': { description: 'Seasonal archive titles' } },
      },
    },
    '/api/v1/top': {
      get: {
        tags: ['Top Collections'],
        summary: 'Curated Anime Rankings',
        parameters: [
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['trending', 'popular', 'rated', 'movies', 'airing', 'upcoming'], default: 'trending' },
          },
          {
            name: 'isAdult',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['false', 'true', 'all'], default: 'false' },
          },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Top ranked master franchises' } },
      },
    },
    '/api/v1/awards/latest': {
      get: {
        tags: ['Anime Awards'],
        summary: 'Latest Anime Awards Winners',
        responses: { '200': { description: 'Current year anime awards' } },
      },
    },
    '/api/v1/awards/{year}': {
      get: {
        tags: ['Anime Awards'],
        summary: 'Historical Anime Awards by Year',
        parameters: [
          { name: 'year', in: 'path', required: true, schema: { type: 'integer', example: 2026 } },
        ],
        responses: { '200': { description: 'Awards for specified year' } },
      },
    },
    '/api/v1/awards/category/{categorySlug}': {
      get: {
        tags: ['Anime Awards'],
        summary: 'Awards by Category',
        parameters: [
          { name: 'categorySlug', in: 'path', required: true, schema: { type: 'string', example: 'anime-of-the-year' } },
        ],
        responses: { '200': { description: 'Category award history' } },
      },
    },
    '/api/v1/characters/{idOrSlug}': {
      get: {
        tags: ['Characters & Staff'],
        summary: 'Character Dossier & Voice Actors',
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string', example: '89362' } },
        ],
        responses: { '200': { description: 'Character profile, traits, and seiyuu links' } },
      },
    },
    '/api/v1/characters/search': {
      get: {
        tags: ['Characters & Staff'],
        summary: 'Search Characters by Name',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', example: 'Julius' } },
        ],
        responses: { '200': { description: 'Matching characters' } },
      },
    },
    '/api/v1/staff/{idOrSlug}': {
      get: {
        tags: ['Characters & Staff'],
        summary: 'Staff & Voice Actor Profile',
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string', example: '111575' } },
        ],
        responses: { '200': { description: 'Voice actor profile and roles' } },
      },
    },
    '/api/v1/staff/search': {
      get: {
        tags: ['Characters & Staff'],
        summary: 'Search Staff by Name',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', example: 'Megumi Han' } },
        ],
        responses: { '200': { description: 'Matching staff members' } },
      },
    },
    '/api/v1/search': {
      get: {
        tags: ['Discovery & Search'],
        summary: 'Global Search across Anime Catalog',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', example: 'titan' } },
        ],
        responses: { '200': { description: 'Search results' } },
      },
    },
    '/api/v1/search/suggest': {
      get: {
        tags: ['Discovery & Search'],
        summary: 'Fast Autocomplete Search Suggestions',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', example: 'frieren' } },
        ],
        responses: { '200': { description: 'Autocomplete suggestion pills' } },
      },
    },
    '/api/v1/manga': {
      get: {
        tags: ['Print Media (Manga & Novels)'],
        summary: 'Search & Filter Manga, Manhwa, Manhua & Light Novels',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string', example: 'solo leveling' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['MANGA', 'MANHWA', 'MANHUA', 'LIGHT_NOVEL', 'WEB_NOVEL', 'ONE_SHOT'] } },
          { name: 'isAdult', in: 'query', schema: { type: 'string', enum: ['false', 'true', 'all'], default: 'false' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: { '200': { description: 'Reading catalog entries with pagination metadata' } },
      },
    },
    '/api/v1/manga/top': {
      get: {
        tags: ['Print Media (Manga & Novels)'],
        summary: 'Curated Top Manga, Manhwa & Novels',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['popular', 'rated', 'manhwa', 'novels'], default: 'popular' } },
          { name: 'isAdult', in: 'query', schema: { type: 'string', enum: ['false', 'true', 'all'], default: 'false' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Ranked reading catalog titles' } },
      },
    },
    '/api/v1/manga/manhwa': {
      get: {
        tags: ['Print Media (Manga & Novels)'],
        summary: 'Top Korean Webtoons & Manhwa',
        parameters: [
          { name: 'isAdult', in: 'query', schema: { type: 'string', enum: ['false', 'true', 'all'], default: 'false' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Top Korean Manhwa titles' } },
      },
    },
    '/api/v1/manga/types': {
      get: {
        tags: ['Print Media (Manga & Novels)'],
        summary: 'Category Counts across Reading Archives',
        parameters: [
          { name: 'isAdult', in: 'query', schema: { type: 'string', enum: ['false', 'true', 'all'], default: 'all' } },
        ],
        responses: { '200': { description: 'Category counts breakdown' } },
      },
    },
    '/api/v1/manga/{idOrSlug}': {
      get: {
        tags: ['Print Media (Manga & Novels)'],
        summary: 'Manga / Manhwa / Novel Dossier',
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string', example: 'solo-leveling' } },
        ],
        responses: { '200': { description: 'Full print media entry' } },
      },
    },
    '/api/v1/manga/{idOrSlug}/adaptations': {
      get: {
        tags: ['Print Media (Manga & Novels)'],
        summary: 'Linked Anime Adaptations & Spinoffs',
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string', example: 'solo-leveling' } },
        ],
        responses: { '200': { description: 'Cross-media adaptation links' } },
      },
    },
    '/api/v1/manga/{idOrSlug}/characters': {
      get: {
        tags: ['Print Media (Manga & Novels)'],
        summary: 'Characters in Manga / Novel',
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string', example: 'solo-leveling' } },
        ],
        responses: { '200': { description: 'Characters appearing in work' } },
      },
    },
    '/api/v1/manga/{idOrSlug}/chapters': {
      get: {
        tags: ['Print Media (Manga & Novels)'],
        summary: 'Live Chapters & Official Legal Sources',
        parameters: [
          { name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string', example: 'solo-leveling' } },
          { name: 'language', in: 'query', schema: { type: 'string', default: 'en' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: { '200': { description: 'Chapter feed and licensing URLs' } },
      },
    },
  },
};
