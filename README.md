<div align="center">

# ⛩️ AniNexus Core Gateway
### High-Performance Anime Metadata, Master Franchise & Intelligence REST API Engine

[![Engine: Node.js / Express](https://img.shields.io/badge/Engine-Node.js%20%2F%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://expressjs.com/)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Database: MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Hosting: Render](https://img.shields.io/badge/Deploy-Render.com-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://ani-nexus.onrender.com/health)
[![Architecture: REST API v1](https://img.shields.io/badge/Protocol-REST%20v1%20(JSON)-8B5CF6?style=for-the-badge)](https://aninexus-api-website.pages.dev/docs)
[![Auth: Zero-Token Free](https://img.shields.io/badge/Auth-100%25%20Free%20%2F%20Open-3B82F6?style=for-the-badge)](https://aninexus-api-website.pages.dev/docs)

<p align="center">
  <a href="https://ani-nexus.onrender.com/health"><strong>Gateway Health Status »</strong></a>
  •
  <a href="https://aninexus-api-website.pages.dev/docs"><strong>Interactive API Playground »</strong></a>
  •
  <a href="https://aninexus-api-website.pages.dev/openapi.json"><strong>OpenAPI 3.1 Spec »</strong></a>
  •
  <a href="https://aninexus-api-website.pages.dev/llms.txt"><strong>AI Agent Context (llms.txt) »</strong></a>
  •
  <a href="https://aninexus-api-website.pages.dev"><strong>Developer Portal »</strong></a>
</p>

</div>

---

## 📖 Engine Overview

**`ani-nexus`** is the core backend microservice and gateway powering the **AniNexus Anime Intelligence Platform**. It ingests, normalizes, consolidates, and serves rich anime metadata from multiple tier-1 sources (MyAnimeList, AniList, TMDB, Anime News Network, Crunchyroll, and Anime Corner) through a lightning-fast, stateless RESTful interface.

### Key Architectural Highlights
1. **Franchise Consolidation Engine:** Aggregates disjointed anime seasons, movies, OVAs, and specials into chronological watch orders across **371+ curated Master Franchises (2010–2026)**.
2. **Dual-Score Consensus Engine:** Combines MyAnimeList (1-10) and AniList (1-100) scores with dual community weighting.
3. **100% Verified Dub Matrix:** Tracks localized audio dubbing and subtitle availability flags (Hindi, English, Japanese, Bengali, Tamil, Telugu).
4. **5-Year Rolling Awards Vault:** Curates Crunchyroll Anime Awards from 2021 to 2026 with strict automated 6th-year auto-purge (`HTTP 410 Gone`).
5. **Intelligent News & Editorial Routing:** Automatically syncs RSS feeds every cycle. Items with verified cover images route to `/api/v1/news`, while text-only editorials route to `/api/v1/articles` (enforced with 60-day MongoDB TTL auto-purge).
6. **Zero-Token Public Access:** CORS-enabled (`*`) public endpoints with rate-limiting protection (60 req/min).

---

## ⚡ Live Gateway Information

* **Base REST API URL:** `https://ani-nexus.onrender.com/api/v1`
* **Health Check & Uptime:** `https://ani-nexus.onrender.com/health`
* **Root Index:** `https://ani-nexus.onrender.com/`
* **Response Content-Type:** `application/json; charset=utf-8`
* **CORS:** Enabled for all browser origins (`Access-Control-Allow-Origin: *`)

---

## 🚀 How to Use the API (For Developers & Consumers)

### 1. Fetch Popular / Trending Franchises
```bash
curl -s "https://ani-nexus.onrender.com/api/v1/top?type=popular&limit=5"
```

### 2. Fetch Franchise Chronological Timeline
```bash
curl -s "https://ani-nexus.onrender.com/api/v1/series/attack-on-titan/timeline"
```

### 3. JavaScript / Fetch Integration
```javascript
const res = await fetch("https://ani-nexus.onrender.com/api/v1/top?type=trending&limit=10");
const { data } = await res.json();

data.forEach(anime => {
  console.log(`${anime.title.romaji} (Score: ${anime.combinedScore}/100)`);
  console.log(`Hindi Dub Available: ${anime.dubAvailability?.hasHindiDub}`);
  console.log(`English Dub Available: ${anime.dubAvailability?.hasEnglishDub}`);
});
```

### 4. Python Integration
```python
import requests

res = requests.get("https://ani-nexus.onrender.com/api/v1/seasons/now").json()
for title in res.get("data", [])[:5]:
    print(title["title"]["romaji"], title.get("combinedScore"))
```

---

## 📋 Complete REST Endpoints Reference (19 Live Endpoints)

| Category | Method | Route | Description |
| :--- | :---: | :--- | :--- |
| **System** | `GET` | `/health` | Server process uptime, ISO timestamp, and health status |
| **System** | `GET` | `/` | API root documentation index and system summary |
| **Top** | `GET` | `/api/v1/top` | Leaderboards (`trending`, `popular`, `rated`, `movies`, `airing`) |
| **Seasons** | `GET` | `/api/v1/seasons/now` | Currently broadcasting anime for the active seasonal quarter |
| **Seasons** | `GET` | `/api/v1/seasons/upcoming` | Upcoming anime releases for next broadcast cycles |
| **Seasons** | `GET` | `/api/v1/seasons/:year/:season` | Historical seasonal archive (e.g. `2024/fall`) |
| **Awards** | `GET` | `/api/v1/awards` | 5-Year rolling award window metadata (2021–2026) |
| **Awards** | `GET` | `/api/v1/awards/latest` | Official latest edition Crunchyroll Anime Awards results |
| **Awards** | `GET` | `/api/v1/awards/:year` | Awards by year (2021–2026 active; `< 2021` returns `410 Gone`) |
| **Awards** | `GET` | `/api/v1/awards/category/:slug` | Category historical timeline (e.g. `anime-of-the-year`) |
| **Franchise** | `GET` | `/api/v1/series/:slug` | Master consolidated franchise dossier (e.g. `solo-leveling`) |
| **Franchise** | `GET` | `/api/v1/series/:slug/timeline`| Chronological watch order of all seasons, OVAs & movies |
| **Franchise** | `GET` | `/api/v1/series/:slug/episodes`| Consolidated episode directory with filler/canon tags |
| **Anime** | `GET` | `/api/v1/anime/:idOrSlug` | Single season/film part by MAL ID or title slug |
| **Anime** | `GET` | `/api/v1/anime/:idOrSlug/languages` | Audio dub & subtitle availability matrix |
| **Search** | `GET` | `/api/v1/search?q={query}` | Typo-tolerant omni-search across Romaji, English, Kanji |
| **Filter** | `GET` | `/api/v1/filter?genre={g}&year={y}` | Multi-criteria catalog filter |
| **Genres** | `GET` | `/api/v1/genres` | 34 curated official anime genres with display metadata |
| **Schedule** | `GET` | `/api/v1/schedule` | Weekly 7-day broadcast calendar with localized dub flags |
| **News** | `GET` | `/api/v1/news` | Industry news guaranteed with cover photos (60-day TTL) |
| **Articles** | `GET` | `/api/v1/articles` | Editorial character breakdowns & reviews (60-day TTL) |
| **Trailers** | `GET` | `/api/v1/trailers` | Official YouTube promotional video embeds & stills |

---

## 🏗️ Architecture & Internal Services

```
src/
├── config/             # Database connection & runtime configuration
├── models/             # Mongoose schemas (Franchise, Award, News, Genre)
├── routes/             # Express route controllers for all 19 endpoints
├── services/           # Data aggregation pipelines & 3rd-party clients
│   ├── franchiseBuilder.ts   # Multi-season timeline stitching engine
│   ├── newsService.ts        # Image-based news vs article router (60-day TTL)
│   ├── awardService.ts       # 5-year rolling window & 410 auto-purge policy
│   ├── malService.ts         # MyAnimeList round-robin API key pool client
│   ├── anilistService.ts     # AniList GraphQL client
│   ├── tmdbService.ts        # TMDB 4K backdrops & legal streaming links
│   └── themesService.ts      # OP/ED anime themes aggregator
├── scripts/            # Database seeding & synchronization utilities
│   ├── seedTop.ts            # Seed top 100 franchises
│   ├── seedAwards.ts         # Seed Crunchyroll awards (2021-2026)
│   ├── seedCurated.ts        # Seed curated master franchise list
│   └── dailySync.ts          # Daily cron sync (RSS feeds & schedule)
└── app.ts / index.ts   # Express server bootstrap & middleware pipeline
```

---

## 💻 Local Setup & Development

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB Atlas** or local MongoDB instance (v6.0+)
- **Git**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Shouvikdasprojects/ani-nexus.git
cd ani-nexus

# Install dependencies
npm install
```

### 3. Environment Variables Setup
Create a `.env` file in the root directory:
```env
PORT=5055
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/aninexus?retryWrites=true&w=majority

# TMDB Key for High-Res Imagery & Legal Streaming Links
TMDB_API_KEY=your_tmdb_api_key_here

# MyAnimeList 5-Key Pool (Round-Robin Rotator)
MAL_KEY_1=your_mal_key_1
MAL_KEY_2=your_mal_key_2
MAL_KEY_3=your_mal_key_3
MAL_KEY_4=your_mal_key_4
MAL_KEY_5=your_mal_key_5
```

### 4. Running the Server
```bash
# Start in development mode with hot-reloading (via tsx)
npm run dev

# Compile TypeScript to JavaScript
npm run build

# Start production server
npm start
```

### 5. Seeding & Sync Scripts
```bash
# Seed the curated master franchises
npm run seed:curated

# Seed the Crunchyroll Anime Awards (2021–2026 editions)
npm run seed:awards

# Seed top leaderboards
npm run seed:top

# Run manual daily RSS feeds & broadcast sync
npm run sync:daily
```

---

## 🤖 AI Agent & LLM Integration

AniNexus exposes machine-readable specifications designed for seamless LLM and AI agent integration:

* **OpenAPI 3.1 Spec:** `https://aninexus-api-website.pages.dev/openapi.json`
* **`llms.txt` Prompt Context:** `https://aninexus-api-website.pages.dev/llms.txt`

Pass `https://aninexus-api-website.pages.dev/llms.txt` directly to ChatGPT, Claude, Cursor, Copilot, or Antigravity to build anime tools without manual documentation parsing.

---

## 👨‍💻 Engineering & Maintainer

* **Author:** [Shouvik Das](https://github.com/Shouvikdasprojects)
* **Consensus Sources:** MyAnimeList, AniList, TMDB, Anime News Network, Crunchyroll, Anime Corner.
* **License:** [MIT License](LICENSE)
