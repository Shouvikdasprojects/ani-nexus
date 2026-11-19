# 🏛️ AniNexus Master Blueprint & Conversation History Log

## 1. Project Identity & Architecture
- **Project Name:** AniNexus
- **Directory:** `C:\Users\hp\OneDrive\Documents\Shouvik Work\ani-nexus`
- **Core Purpose:** Enterprise-grade, legal, comprehensive anime intelligence REST API.
- **Strict Compliance:** Zero video hosting/piracy scraping. Verified OTT platforms (Crunchyroll, Netflix, Prime Video, Muse Asia).

## 2. Completed Architecture Components

### A. Database (MongoDB Atlas)
- **Cluster:** `cluster0.mfrvpnh.mongodb.net`
- **Database:** `aninexus`
- **Collections:**
  - `franchises`: Master Franchise documents containing 3-tier titles, chronological timeline, verified dubs, dual scores, characters, voice actor dossiers, episode lists, and OTT links.
  - `news`: Live anime news and editorial articles with a **60-day auto-purge TTL index** (`expireAfterSeconds: 5184000`).
  - `genres`: 50+ genres, themes, demographics, and adult tags.

### B. Upstream Data Aggregators
1. **MAL Service (`src/services/malService.ts`):**
   - 5-Key Round-Robin rotation with 429 backoff cooldown.
   - Fetches official English titles, MAL community scores (10-scale), ranks, and popularity.
2. **AniList Service (`src/services/anilistService.ts`):**
   - GraphQL queries for Romaji, native Kanji, character dossiers, voice actor casting credits, and 7-day live airing schedules.
3. **TMDB Service (`src/services/tmdbService.ts`):**
   - 4K backdrops, transparent PNG logos, season episode directory (stills, synopses), and JustWatch legal OTT watch providers.
4. **AnimeThemes Service (`src/services/themesService.ts`):**
   - Openings and Endings songs, artists, and streaming video/audio links.
5. **News Service (`src/services/newsService.ts`):**
   - Multi-source RSS ingestion (ANN, Anime Corner, Crunchyroll News).
   - Dual-classifier: Image present -> `news`, no image -> `article`.
6. **Franchise Builder (`src/services/franchiseBuilder.ts`):**
   - Master aggregator uniting all services into a single clean franchise document.
   - Verified audio dub extraction from voice actors (Japanese, English, Hindi, Spanish, French, German, Italian, etc.).

### C. Live Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root API overview & health check |
| `GET` | `/health` | Server uptime & status |
| `GET` | `/api/v1/series/:slug` | Full master franchise record (with on-demand cache-aside ingestion) |
| `GET` | `/api/v1/series/:slug/timeline` | Chronological watch order roadmap |
| `GET` | `/api/v1/series/:slug/episodes` | Complete episode breakdown directory |
| `GET` | `/api/v1/anime/:idOrSlug` | Single anime part lookup (MAL ID, AniList ID, or slug) |
| `GET` | `/api/v1/anime/:idOrSlug/languages` | Direct verified audio dubs and subtitles |
| `GET` | `/api/v1/schedule` | 7-day broadcast calendar with live countdown |
| `GET` | `/api/v1/trailers` | YouTube trailers carousel feed |
| `GET` | `/api/v1/news` | 60-day auto-purged news feed (with verified cover photos) |
| `GET` | `/api/v1/articles` | Editorial text digests & analysis (without images) |
| `POST` | `/api/v1/sync` | Manual trigger for news RSS sync |
| `GET` | `/api/v1/genres` | 50+ genres, themes, and demographics catalog |
| `GET` | `/api/v1/genres/:slug` | Anime belonging to a specific genre |
| `GET` | `/api/v1/genres/all/filter` | Multi-criteria filtering by genre, year, status, dub, rating |
| `GET` | `/api/v1/search?q={title}` | Typo-tolerant, multi-tier search across English, Romaji, and Kanji |
| `GET` | `/api/v1/search/suggest?q={title}` | Fast autocomplete search suggestion pills |

### D. Automation & CLI Seeders
- `npm run seed:top -- --limit=250`: Preloads top anime with progress logging.
- `npm run seed:range -- --start=2010 --end=2026`: Preloads anime franchises across years 2010 to 2026.
- `npm run sync:daily`: Syncs live airing broadcasts and fresh news.
- `.github/workflows/daily-sync.yml`: Free daily GitHub Actions cron workflow.

## 3. Live Verification & Database Status
- **Date Range Seeder Run (2010 to 2026):**
  - **255 items processed across 17 years** with **zero failures** (`0 failed`).
  - Total unique master franchises in MongoDB Atlas: **194** (all multi-season works like Attack on Titan, JJK, Demon Slayer unified into single master franchise documents).
  - News Articles in DB: **60**
  - Genres in DB: **34**
  - Disk storage used in Atlas: **12.46 MB** (499.54 MB remaining of 512 MB free tier; 97.6% free space available).
  - API response speed: ~230ms for search, ~240ms for complex genre filters.
