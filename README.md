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

**`ani-nexus`** is the core backend microservice and gateway powering the **AniNexus Anime Intelligence Platform**. It ingests, normalizes, consolidates, and serves rich anime metadata from multiple tier-1 global metadata feeds and verified community consensus engines through a lightning-fast, stateless RESTful interface.

### Key Architectural Highlights
1. **Franchise Consolidation Engine:** Aggregates disjointed anime seasons, movies, OVAs, and specials into chronological watch orders across **634+ curated Master Franchises (2010–2026)**.
2. **1024MB Dual-Vault Architecture:** Distributed cross-cluster data store featuring Primary Vault (`cluster0`) and Vault 2 (`aninexusapidb2`).
3. **Universal Characters & Staff Encyclopedia:** 3,553+ comprehensive Character dossiers (physical traits, markdown biographies, multi-lingual seiyuu credits) and 2,172+ Staff/Creators profiles.
4. **Dual-Score Consensus Engine:** Combines dual global community scores with calibrated consensus weighting.
5. **100% Verified Per-Part Language Matrix:** Tracks granular audio dubbing and subtitle availability flags (Hindi, English, Japanese, Bengali, Tamil, Telugu) per season and movie (`/api/v1/anime/:idOrSlug/languages`).
6. **7-Day Live Broadcast Airing Calendar:** 138+ weekly live airing episodes with UTC countdowns, episode progress counters, and main animation studio credits (`/api/v1/schedule`).
7. **5-Year Rolling Awards Vault:** Curates Official Industry Anime Awards from 2021 to 2026 with strict automated 6th-year auto-purge (`HTTP 410 Gone`).
8. **Intelligent News & Editorial Routing:** Automatically syncs RSS feeds every cycle. Items with verified cover images route to `/api/v1/news`, while text-only editorials route to `/api/v1/articles` (enforced with 60-day MongoDB TTL auto-purge).
9. **Zero-Token Public Access:** CORS-enabled (`*`) public endpoints with rate-limiting protection (60 req/min).

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
| **Awards** | `GET` | `/api/v1/awards/latest` | Official latest edition Official Industry Anime Awards results |
| **Awards** | `GET` | `/api/v1/awards/:year` | Awards by year (2021–2026 active; `< 2021` returns `410 Gone`) |
| **Awards** | `GET` | `/api/v1/awards/category/:slug` | Category historical timeline (e.g. `anime-of-the-year`) |
| **Franchise** | `GET` | `/api/v1/series/:slug` | Master consolidated franchise dossier (e.g. `solo-leveling`) |
| **Franchise** | `GET` | `/api/v1/series/:slug/timeline`| Chronological watch order of all seasons, OVAs & movies |
| **Franchise** | `GET` | `/api/v1/series/:slug/episodes`| Consolidated episode directory with filler/canon tags |
| **Franchise** | `GET` | `/api/v1/series/:slug/characters`| Cast & Voice Actors Dossier |
| **Franchise** | `GET` | `/api/v1/series/:slug/staff`| Animation Studios & Key Production Staff |
| **Characters** | `GET` | `/api/v1/characters/:idOrSlug`| Comprehensive Character Encyclopedia (3,553+ profiles) |
| **Characters** | `GET` | `/api/v1/characters/search?q={query}`| Search characters by name, romaji, or alias |
| **Staff** | `GET` | `/api/v1/staff/:idOrSlug`| Production Staff & Seiyuu Encyclopedia (2,172+ profiles) |
| **Staff** | `GET` | `/api/v1/staff/search?q={query}`| Search voice actors, directors, and creators |
| **Anime** | `GET` | `/api/v1/anime/:idOrSlug` | Single season/film part by Anime ID or title slug |
| **Anime** | `GET` | `/api/v1/anime/:idOrSlug/languages` | Audio dub & subtitle availability matrix |
| **Seasons** | `GET` | `/api/v1/seasons/:year/:season` | Archive for specific season (AniChart parity) |
| **Search** | `GET` | `/api/v1/search?q={query}` | Typo-tolerant omni-search across Romaji, English, Kanji |
| **Filter** | `GET` | `/api/v1/filter?genre={g}&year={y}` | Multi-criteria catalog filter |
| **Genres** | `GET` | `/api/v1/genres` | 34 curated official anime genres with display metadata |
| **Schedule** | `GET` | `/api/v1/schedule` | Weekly 7-day broadcast calendar (138+ weekly live shows) |
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
│   ├── coreProviderService.ts# Multi-source upstream connector client
│   ├── mediaSyncService.ts   # Secondary GraphQL consensus client
│   ├── ottMetadataService.ts # 4K backdrops & legal streaming links service
│   └── themesService.ts      # OP/ED anime themes aggregator
├── scripts/            # Database seeding & synchronization utilities
│   ├── seedTop.ts            # Seed top 100 franchises
│   ├── seedAwards.ts         # Seed Anime Awards (2021-2026)
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

# OTT & High-Res Imagery Pipeline Key
MEDIA_API_KEY=your_media_api_key_here

# Multi-Key Round-Robin Rotator Pool
KEY_1=your_mal_key_1
KEY_2=your_mal_key_2
KEY_3=your_mal_key_3
KEY_4=your_mal_key_4
KEY_5=your_mal_key_5
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

# Seed the Official Industry Anime Awards (2021–2026 editions)
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

## 👨‍💻 Engineering, Maintainer & Connect

**Engineered & Maintained by [Shouvik Das](https://github.com/Shouvikdasprojects)**

Feel free to connect or collaborate:

<p align="left">
  <a href="https://heylink.me/ShouvikDas/"><img src="https://img.shields.io/badge/All%20Socials-HeyLink-00C4CC?style=for-the-badge&logo=linktree&logoColor=white" alt="HeyLink" /></a>
  <a href="https://x.com/shouvikdas155"><img src="https://img.shields.io/badge/X%20(Twitter)-@shouvikdas155-000000?style=for-the-badge&logo=x&logoColor=white" alt="X" /></a>
  <a href="https://instagram.com/shouvik_das_official"><img src="https://img.shields.io/badge/Instagram-@shouvik__das__official-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram" /></a>
  <a href="mailto:shouvikdaswork@gmail.com"><img src="https://img.shields.io/badge/Email-shouvikdaswork@gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Email" /></a>
  <a href="https://github.com/Shouvikdasprojects"><img src="https://img.shields.io/badge/GitHub-Shouvikdasprojects-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" /></a>
</p>

* 📬 **Direct Email:** [shouvikdaswork@gmail.com](mailto:shouvikdaswork@gmail.com)
* 🌐 **All Socials Hub:** [heylink.me/ShouvikDas](https://heylink.me/ShouvikDas/)
* 𝕏 **X (Twitter):** [@shouvikdas155](https://x.com/shouvikdas155)
* 📸 **Instagram:** [@shouvik_das_official](https://instagram.com/shouvik_das_official)
* 🐙 **GitHub:** [@Shouvikdasprojects](https://github.com/Shouvikdasprojects)
* 📊 **Consensus Sources:** Verified global anime community consensus, official industry publications, and licensed media partners.
* 📄 **License:** [MIT License](LICENSE)
