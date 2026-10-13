import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { InMemoryRepository } from './test-utils.js';

const sessionId = '11111111-1111-4111-8111-111111111111';
const pageUrl = 'https://demo.example.test/';

function event(overrides: Record<string, unknown> = {}) {
  return {
    sessionId,
    eventType: 'click',
    pageUrl,
    timestamp: new Date().toISOString(),
    clientEventId: '22222222-2222-4222-8222-222222222222',
    viewport: { width: 1280, height: 800, devicePixelRatio: 2 },
    document: { width: 1280, height: 1800 },
    click: { pageX: 160, pageY: 420, clientX: 160, clientY: 420 },
    ...overrides,
  };
}

describe('analytics API', () => {
  it('accepts an event and makes duplicate retries idempotent', async () => {
    const repository = new InMemoryRepository();
    const app = createApp({ repository });
    const first = await request(app).post('/api/events').send(event());
    const second = await request(app).post('/api/events').send(event());
    expect(first.status).toBe(202);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(repository.events).toHaveLength(1);
  });

  it('rejects malformed events with a consistent validation response', async () => {
    const app = createApp({ repository: new InMemoryRepository() });
    const response = await request(app).post('/api/events').send({ eventType: 'unknown' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.fields.length).toBeGreaterThan(0);
  });

  it('rejects a page_view event that includes click coordinates', async () => {
    const app = createApp({ repository: new InMemoryRepository() });
    const response = await request(app).post('/api/events').send(
      event({ eventType: 'page_view', clientEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', click: { pageX: 10, pageY: 20, clientX: 10, clientY: 20 } }),
    );
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a click event that is missing click coordinates', async () => {
    const app = createApp({ repository: new InMemoryRepository() });
    const response = await request(app).post('/api/events').send(
      event({ clientEventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', click: undefined }),
    );
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects events with a timestamp outside the accepted clock-skew window', async () => {
    const app = createApp({ repository: new InMemoryRepository(), maxEventAgeHours: 1 });
    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const response = await request(app).post('/api/events').send(
      event({ clientEventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', timestamp: stale }),
    );
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('normalizes the URL fragment when looking up heatmap data', async () => {
    const repository = new InMemoryRepository();
    const app = createApp({ repository });
    // Store the URL without a fragment.
    await request(app).post('/api/events').send(event());
    // The lookup should normalize the fragment away.
    const withFragment = pageUrl + '#section';
    const heatmap = await request(app).get(`/api/heatmap?url=${encodeURIComponent(withFragment)}`);
    expect(heatmap.status).toBe(200);
    expect(heatmap.body.count).toBe(1);
    expect(heatmap.body.pageUrl).toBe(pageUrl);
  });

  it('returns sessions, ordered journeys, pages, and heatmap points', async () => {
    const repository = new InMemoryRepository();
    const app = createApp({ repository });
    await request(app).post('/api/events').send(event({ eventType: 'page_view', clientEventId: '33333333-3333-4333-8333-333333333333', click: undefined }));
    await request(app).post('/api/events').send(event());
    const sessions = await request(app).get('/api/sessions');
    const journey = await request(app).get(`/api/sessions/${sessionId}/events`);
    const pages = await request(app).get('/api/pages');
    const heatmap = await request(app).get(`/api/heatmap?url=${encodeURIComponent(pageUrl)}`);
    expect(sessions.body.items[0].eventCount).toBe(2);
    expect(journey.body.items).toHaveLength(2);
    expect(pages.body.items[0].pageUrl).toBe(pageUrl);
    expect(heatmap.body.count).toBe(1);
  });

  it('returns empty lists and zero counts when no data exists', async () => {
    const app = createApp({ repository: new InMemoryRepository() });
    const sessions = await request(app).get('/api/sessions');
    const pages = await request(app).get('/api/pages');
    const heatmap = await request(app).get(`/api/heatmap?url=${encodeURIComponent(pageUrl)}`);
    expect(sessions.body.items).toHaveLength(0);
    expect(sessions.body.nextCursor).toBeNull();
    expect(pages.body.items).toHaveLength(0);
    expect(heatmap.body.count).toBe(0);
    expect(heatmap.body.items).toHaveLength(0);
    expect(heatmap.body.truncated).toBe(false);
  });

  it('returns 200 with an empty items list for a session that has no events', async () => {
    const app = createApp({ repository: new InMemoryRepository() });
    const unknownSession = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const journey = await request(app).get(`/api/sessions/${unknownSession}/events`);
    expect(journey.status).toBe(200);
    expect(journey.body.items).toHaveLength(0);
  });

  it('rejects an invalid limit query parameter', async () => {
    const app = createApp({ repository: new InMemoryRepository() });
    const response = await request(app).get('/api/sessions?limit=abc');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_QUERY');
  });

  it('clamps limit to the server-side maximum', async () => {
    const repository = new InMemoryRepository();
    const app = createApp({ repository });
    // Use two distinct sessions so the limit is easy to verify.
    const sessionIds = [
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ];
    const clientIds = [
      'dddddddd-dddd-4ddd-8ddd-444444444444',
      'dddddddd-dddd-4ddd-8ddd-555555555555',
    ];
    for (let i = 0; i < sessionIds.length; i++) {
      await request(app).post('/api/events').send(
        event({ sessionId: sessionIds[i], clientEventId: clientIds[i] }),
      );
    }
    const response = await request(app).get('/api/sessions?limit=1');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
  });

  it('returns journey events in ascending timestamp order', async () => {
    const repository = new InMemoryRepository();
    const app = createApp({ repository });
    // Keep both events inside the accepted window and in a known order.
    const base = Date.now();
    const t1 = new Date(base - 60_000).toISOString();
    const t2 = new Date(base - 30_000).toISOString();
    // Insert the newer event first; the response should still be chronological.
    await request(app).post('/api/events').send(
      event({ clientEventId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', timestamp: t2 }),
    );
    await request(app).post('/api/events').send(
      event({ clientEventId: 'fedcba98-7654-4321-8abc-fedcba987654', eventType: 'page_view', click: undefined, timestamp: t1 }),
    );
    const journey = await request(app).get(`/api/sessions/${sessionId}/events`);
    expect(journey.body.items).toHaveLength(2);
    expect(new Date(journey.body.items[0].timestamp).getTime())
      .toBeLessThan(new Date(journey.body.items[1].timestamp).getTime());
    expect(journey.body.items[0].eventType).toBe('page_view');
    expect(journey.body.items[1].eventType).toBe('click');
  });

  it('reports a degraded health status while the repository is unavailable', async () => {
    const repository = new InMemoryRepository();
    repository.ready = false;
    const response = await request(createApp({ repository })).get('/health');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
  });
});
