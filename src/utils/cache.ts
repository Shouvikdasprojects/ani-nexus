import { Request, Response, NextFunction } from 'express';

/**
 * Smart HTTP Caching Middleware
 * Adds Cache-Control headers with stale-while-revalidate for edge CDNs (Cloudflare) and client browsers.
 */
export function smartCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path.toLowerCase();

  // Dynamic/Real-time routes: 10 mins cache, 1 hour stale fallback
  if (
    path.startsWith('/api/v1/schedule') ||
    path.startsWith('/api/v1/seasons/now') ||
    path.startsWith('/api/v1/news') ||
    path.startsWith('/api/v1/articles') ||
    path.startsWith('/api/v1/trailers')
  ) {
    res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
  }
  // Master Catalog / Static Archives: 1 hour cache, 24 hours stale fallback
  else if (
    path.startsWith('/api/v1/series') ||
    path.startsWith('/api/v1/anime') ||
    path.startsWith('/api/v1/manga') ||
    path.startsWith('/api/v1/characters') ||
    path.startsWith('/api/v1/staff') ||
    path.startsWith('/api/v1/genres') ||
    path.startsWith('/api/v1/awards') ||
    path.startsWith('/api/v1/top') ||
    path.startsWith('/api/v1/filter') ||
    path.startsWith('/api/v1/seasons')
  ) {
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  }
  // Root, OpenAPI Spec: 12 hours cache
  else if (path === '/openapi.json' || path === '/api/v1/openapi.json') {
    res.setHeader('Cache-Control', 'public, max-age=43200, stale-while-revalidate=86400');
  }
  // Health and Sync: strictly fresh
  else if (path.startsWith('/health') || path === '/' || path.includes('/sync')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  next();
}
