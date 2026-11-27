import { Request, Response, NextFunction } from 'express';

/**
 * Smart HTTP Caching Middleware
 * Adds Cache-Control headers with stale-while-revalidate for edge CDNs (Cloudflare) and client browsers.
 * Automatically forces no-store on 4xx/5xx responses before headers flush so errors are never cached.
 */
export function smartCacheMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path.toLowerCase();
  let cacheHeader: string | null = null;

  // Dynamic/Real-time routes: 10 mins cache, 1 hour stale fallback
  if (
    path.startsWith('/api/v1/schedule') ||
    path.startsWith('/api/v1/seasons/now') ||
    path.startsWith('/api/v1/news') ||
    path.startsWith('/api/v1/articles') ||
    path.startsWith('/api/v1/trailers') ||
    path.startsWith('/api/v1/search')
  ) {
    cacheHeader = 'public, max-age=600, stale-while-revalidate=3600';
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
    path.startsWith('/api/v1/seasons') ||
    path.startsWith('/api/v1/studios')
  ) {
    cacheHeader = 'public, max-age=3600, stale-while-revalidate=86400';
  }
  // Root, OpenAPI Spec: 12 hours cache
  else if (path === '/openapi.json' || path === '/api/v1/openapi.json') {
    cacheHeader = 'public, max-age=43200, stale-while-revalidate=86400';
  }
  // Health and Sync: strictly fresh
  else if (path.startsWith('/health') || path === '/' || path.includes('/sync')) {
    cacheHeader = 'no-cache, no-store, must-revalidate';
  }

  if (cacheHeader) {
    res.setHeader('Cache-Control', cacheHeader);
  }

  // Prevent edge CDNs from ever caching 4xx/5xx error responses
  const origWriteHead = res.writeHead.bind(res);
  res.writeHead = function patchedWriteHead(this: Response, statusCode: number, ...args: any[]) {
    if (statusCode >= 400) {
      res.setHeader('Cache-Control', 'no-store');
    }
    return origWriteHead(statusCode, ...args);
  } as any;

  next();
}
