import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/app.js';

describe('AniNexus API Engine Integration & Smoke Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('GET /health returns 200 with X-Request-Id and valid health schema', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const requestIdHeader = res.headers.get('x-request-id');
    assert.ok(requestIdHeader, 'X-Request-Id header must be present');
    assert.ok(requestIdHeader.startsWith('req_'), 'X-Request-Id must start with req_');

    const data = await res.json() as any;
    assert.equal(data.status, 'healthy');
    assert.ok(typeof data.uptime === 'number');
    assert.ok(data.timestamp);
    assert.equal(data.requestId, requestIdHeader);
  });

  test('GET /health/detailed returns 200 with vaults, system and rateLimiting telemetry', async () => {
    const res = await fetch(`${baseUrl}/health/detailed`);
    assert.equal(res.status, 200);

    const data = await res.json() as any;
    assert.equal(data.status, 'healthy');
    assert.ok(data.vaults, 'Vaults status must be present');
    assert.ok(data.system, 'System metrics must be present');
    assert.equal(data.rateLimiting.maxPerMinute, 90);
  });

  test('GET /openapi.json returns 200 with valid OpenAPI 3.1.0 document', async () => {
    const res = await fetch(`${baseUrl}/openapi.json`);
    assert.equal(res.status, 200);

    const cacheHeader = res.headers.get('cache-control');
    assert.ok(cacheHeader?.includes('public'), 'OpenAPI spec must have public Cache-Control');

    const spec = await res.json() as any;
    assert.equal(spec.openapi, '3.1.0');
    assert.equal(spec.info.title, 'AniNexus API');
    assert.ok(spec.paths['/api/v1/series/{slug}']);
    assert.ok(spec.paths['/api/v1/schedule']);
    assert.ok(spec.paths['/api/v1/top']);
  });

  test('GET / returns 200 online root index with rate limit declaration', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);

    const data = await res.json() as any;
    assert.equal(data.status, 'online');
    assert.equal(data.version, '1.0.0');
    assert.ok(data.rateLimit.includes('90 requests per minute'));
    assert.ok(Array.isArray(data.features));
  });

  test('GET /api/unknown-route returns 404 with structured error and requestId', async () => {
    const res = await fetch(`${baseUrl}/api/v1/non-existent-endpoint-test-404`);
    assert.equal(res.status, 404);

    const data = await res.json() as any;
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Endpoint not found'));
    assert.ok(data.requestId);
  });
});
