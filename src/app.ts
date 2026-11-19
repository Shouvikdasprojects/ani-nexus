import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { seriesRouter } from './routes/seriesRoutes.js';
import { animeRouter } from './routes/animeRoutes.js';
import { scheduleRouter } from './routes/scheduleRoutes.js';
import { trailerRouter } from './routes/trailerRoutes.js';
import { newsRouter } from './routes/newsRoutes.js';
import { genreRouter, filterRouter } from './routes/genreRoutes.js';
import { searchRouter } from './routes/searchRoutes.js';
import { seasonRouter } from './routes/seasonRoutes.js';
import { topRouter } from './routes/topRoutes.js';
import { awardRouter } from './routes/awardRoutes.js';

export const app: Application = express();

// Security & Optimization Middlewares
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Root & Health Verification
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    name: 'AniNexus API',
    tagline: 'Enterprise-grade Anime Metadata & Intelligence API',
    version: '1.0.0',
    documentation: {
      series: '/api/v1/series/:slug',
      timeline: '/api/v1/series/:slug/timeline',
      episodes: '/api/v1/series/:slug/episodes',
      anime: '/api/v1/anime/:idOrSlug',
      languages: '/api/v1/anime/:idOrSlug/languages',
      schedule: '/api/v1/schedule',
      trailers: '/api/v1/trailers',
      news: '/api/v1/news',
      articles: '/api/v1/articles',
      genres: '/api/v1/genres',
      filter: '/api/v1/filter?genre=action&year=2024',
      seasonsNow: '/api/v1/seasons/now',
      seasonsUpcoming: '/api/v1/seasons/upcoming',
      seasonsArchive: '/api/v1/seasons/:year/:season',
      top: '/api/v1/top?type={trending|popular|rated|movies|airing|upcoming}',
      awards: '/api/v1/awards',
      awardsLatest: '/api/v1/awards/latest',
      awardsYear: '/api/v1/awards/:year',
      awardsCategory: '/api/v1/awards/category/:categorySlug',
      search: '/api/v1/search?q={title}',
    },
    features: [
      'Master Franchise Document (All seasons, movies, OVAs unified)',
      'Seasonal Hub (Now Airing, Upcoming, Winter/Spring/Summer/Fall Archives)',
      'Curated Top Collections (Trending, Popular, Awards/Highest Rated, Movies)',
      'Anime Awards Hub (Current year + past 5 years with auto-purge 6th-year rolling retention)',
      '3-Tier Titles (English primary, Romaji, Kanji, Synonyms)',
      'Dual Community Scores (MAL 10-scale + AniList 100% scale side-by-side)',
      'Verified Dub & Sub Matrix (Zero hallucination, derived from voice cast)',
      'Official OTT Legal Licensing Links (Crunchyroll, Netflix, Prime Video)',
      'Auto-Purging 60-Day News & Article Feed with TTL Index',
    ],
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount API Endpoints
app.use('/api/v1/series', seriesRouter);
app.use('/api/v1/anime', animeRouter);
app.use('/api/v1/schedule', scheduleRouter);
app.use('/api/v1/trailers', trailerRouter);
app.use('/api/v1', newsRouter); // handles /api/v1/news, /api/v1/articles, /api/v1/sync
app.use('/api/v1/genres', genreRouter);
app.use('/api/v1/filter', filterRouter);
app.use('/api/v1/seasons', seasonRouter);
app.use('/api/v1/top', topRouter);
app.use('/api/v1/awards', awardRouter);
app.use('/api/v1/search', searchRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[AniNexus Global Error]:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});
