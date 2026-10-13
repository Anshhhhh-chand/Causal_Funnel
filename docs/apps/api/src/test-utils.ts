import type { ClientEvent, HeatmapPoint, JourneyEvent, PageSummary, SessionSummary } from '@causalfunnel/contracts';
import type { PageCursor, Repository, SessionCursor } from './repository.js';

export class InMemoryRepository implements Repository {
  public ready = true;
  public events: Array<{ id: string; event: ClientEvent; receivedAt: Date }> = [];

  async connect() { this.ready = true; }
  async close() { this.ready = false; }

  async insertEvent(event: ClientEvent, receivedAt = new Date()) {
    const existing = this.events.find((item) => item.event.clientEventId === event.clientEventId);
    if (existing) return { id: existing.id, duplicate: true };
    const id = `${this.events.length + 1}`;
    this.events.push({ id, event, receivedAt });
    return { id, duplicate: false };
  }

  async listSessions({ limit, cursor }: { limit: number; cursor?: SessionCursor }) {
    const groups = new Map<string, typeof this.events>();
    for (const event of this.events) groups.set(event.event.sessionId, [...(groups.get(event.event.sessionId) ?? []), event]);
    let items = [...groups.entries()].map(([sessionId, rows]) => ({ sessionId, eventCount: rows.length, firstSeenAt: new Date(Math.min(...rows.map((row) => Date.parse(row.event.timestamp)))).toISOString(), lastSeenAt: new Date(Math.max(...rows.map((row) => Date.parse(row.event.timestamp)))).toISOString() } satisfies SessionSummary));
    items.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.sessionId.localeCompare(b.sessionId));
    if (cursor) items = items.filter((item) => item.lastSeenAt < cursor.time || (item.lastSeenAt === cursor.time && item.sessionId > cursor.sessionId));
    const visible = items.slice(0, limit);
    const last = visible.at(-1);
    return { items: visible, nextCursor: items.length > limit && last ? Buffer.from(JSON.stringify({ time: last.lastSeenAt, sessionId: last.sessionId })).toString('base64url') : null };
  }

  async listSessionEvents({ sessionId, limit, cursor }: { sessionId: string; limit: number; cursor?: PageCursor }) {
    let rows = this.events.filter((item) => item.event.sessionId === sessionId).sort((a, b) => Date.parse(a.event.timestamp) - Date.parse(b.event.timestamp) || a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id));
    if (cursor) rows = rows.filter((row) => row.event.timestamp > cursor.time || (row.event.timestamp === cursor.time && row.id > cursor.id));
    const visible = rows.slice(0, limit);
    const items: JourneyEvent[] = visible.map((row) => ({ id: row.id, eventType: row.event.eventType, pageUrl: row.event.pageUrl, timestamp: row.event.timestamp, receivedAt: row.receivedAt.toISOString(), viewport: row.event.viewport, document: row.event.document, click: row.event.click ?? null }));
    const last = visible.at(-1);
    return { items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ time: last.event.timestamp, id: last.id })).toString('base64url') : null };
  }

  async listHeatmap({ pageUrl, limit }: { pageUrl: string; limit: number }) {
    const rows = this.events.filter((item) => item.event.pageUrl === pageUrl && item.event.eventType === 'click');
    const visible = rows.slice(0, limit);
    const items: HeatmapPoint[] = visible.flatMap((row) => row.event.click ? [{ pageX: row.event.click.pageX, pageY: row.event.click.pageY, documentWidth: row.event.document.width, documentHeight: row.event.document.height, viewportWidth: row.event.viewport.width, viewportHeight: row.event.viewport.height, occurredAt: row.event.timestamp }] : []);
    return { items, count: items.length, truncated: rows.length > limit };
  }

  async listPages({ limit }: { limit: number }) {
    const groups = new Map<string, typeof this.events>();
    for (const event of this.events) groups.set(event.event.pageUrl, [...(groups.get(event.event.pageUrl) ?? []), event]);
    const items: PageSummary[] = [...groups.entries()].map(([pageUrl, rows]) => ({ pageUrl, clickCount: rows.filter((row) => row.event.eventType === 'click').length, lastSeenAt: rows.reduce((max, row) => row.event.timestamp > max ? row.event.timestamp : max, '') }));
    items.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
    return { items: items.slice(0, limit), nextCursor: null };
  }
}
