import type { ClientEvent, HeatmapPoint, JourneyEvent, PageSummary, SessionSummary } from '@causalfunnel/contracts';
import { MongoClient, type Collection, type Db, ObjectId } from 'mongodb';

export interface EventDocument {
  _id?: ObjectId;
  clientEventId: string;
  sessionId: string;
  siteId?: string;
  eventType: ClientEvent['eventType'];
  pageUrl: string;
  occurredAt: Date;
  receivedAt: Date;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio?: number;
  documentWidth: number;
  documentHeight: number;
  click?: {
    pageX: number;
    pageY: number;
    clientX?: number;
    clientY?: number;
  };
}

export interface PageCursor {
  time: string;
  id: string;
}

export interface SessionCursor {
  time: string;
  sessionId: string;
}

export interface Repository {
  readonly ready: boolean;
  connect(): Promise<void>;
  close(): Promise<void>;
  insertEvent(event: ClientEvent, receivedAt?: Date): Promise<{ id: string; duplicate: boolean }>;
  listSessions(options: { limit: number; cursor?: SessionCursor; siteId?: string }): Promise<{ items: SessionSummary[]; nextCursor: string | null }>;
  listSessionEvents(options: { sessionId: string; limit: number; cursor?: PageCursor }): Promise<{ items: JourneyEvent[]; nextCursor: string | null }>;
  listHeatmap(options: { pageUrl: string; limit: number; siteId?: string }): Promise<{ items: HeatmapPoint[]; count: number; truncated: boolean }>;
  listPages(options: { limit: number; siteId?: string }): Promise<{ items: PageSummary[]; nextCursor: string | null }>;
}

export class RepositoryUnavailableError extends Error {
  constructor() {
    super('The analytics database is currently unavailable');
    this.name = 'RepositoryUnavailableError';
  }
}

function encodeCursor(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor<T>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    throw new Error('Invalid pagination cursor');
  }
}

function dateString(value: Date): string {
  return value.toISOString();
}

export class MongoEventRepository implements Repository {
  private client: MongoClient;
  private db?: Db;
  private collection?: Collection<EventDocument>;
  public ready = false;

  constructor(private readonly uri: string, private readonly dbName: string) {
    this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 3_000 });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.collection = this.db.collection<EventDocument>('events');
    await this.collection.createIndexes([
      { key: { clientEventId: 1 }, unique: true, name: 'client_event_id_unique' },
      { key: { sessionId: 1, occurredAt: 1, receivedAt: 1, _id: 1 }, name: 'session_journey' },
      { key: { pageUrl: 1, eventType: 1, occurredAt: 1 }, name: 'page_heatmap' },
      { key: { pageUrl: 1, receivedAt: -1 }, name: 'page_catalog' },
    ]);
    this.ready = true;
  }

  async close(): Promise<void> {
    this.ready = false;
    await this.client.close();
  }

  private get events(): Collection<EventDocument> {
    if (!this.collection || !this.ready) throw new RepositoryUnavailableError();
    return this.collection;
  }

  async insertEvent(event: ClientEvent, receivedAt = new Date()): Promise<{ id: string; duplicate: boolean }> {
    const document: EventDocument = {
      clientEventId: event.clientEventId,
      sessionId: event.sessionId,
      siteId: event.siteId,
      eventType: event.eventType,
      pageUrl: event.pageUrl,
      occurredAt: new Date(event.timestamp),
      receivedAt,
      viewportWidth: event.viewport.width,
      viewportHeight: event.viewport.height,
      devicePixelRatio: event.viewport.devicePixelRatio,
      documentWidth: event.document.width,
      documentHeight: event.document.height,
      click: event.click,
    };
    try {
      const result = await this.events.insertOne(document);
      return { id: result.insertedId.toString(), duplicate: false };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const existing = await this.events.findOne({ clientEventId: event.clientEventId }, { projection: { _id: 1 } });
        return { id: existing?._id.toString() ?? event.clientEventId, duplicate: true };
      }
      throw error;
    }
  }

  async listSessions({ limit, cursor, siteId }: { limit: number; cursor?: SessionCursor; siteId?: string }) {
    const match: Record<string, unknown> = siteId ? { siteId } : {};
    const pipeline: object[] = [
      { $match: match },
      { $group: { _id: '$sessionId', eventCount: { $sum: 1 }, firstSeenAt: { $min: '$occurredAt' }, lastSeenAt: { $max: '$occurredAt' } } },
      { $project: { _id: 0, sessionId: '$_id', eventCount: 1, firstSeenAt: 1, lastSeenAt: 1 } },
      { $sort: { lastSeenAt: -1, sessionId: 1 } },
    ];
    if (cursor) {
      pipeline.push({
        $match: {
          $or: [
            { lastSeenAt: { $lt: new Date(cursor.time) } },
            { lastSeenAt: new Date(cursor.time), sessionId: { $gt: cursor.sessionId } },
          ]
        }
      });
    }
    pipeline.push({ $limit: limit + 1 });
    const rows = await this.events.aggregate<{ sessionId: string; eventCount: number; firstSeenAt: Date; lastSeenAt: Date }>(pipeline).toArray();
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit);
    const items = visible.map((row) => ({ sessionId: row.sessionId, eventCount: row.eventCount, firstSeenAt: dateString(row.firstSeenAt), lastSeenAt: dateString(row.lastSeenAt) }));
    const last = visible.at(-1);
    return { items, nextCursor: hasMore && last ? encodeCursor({ time: dateString(last.lastSeenAt), sessionId: last.sessionId }) : null };
  }

  async listSessionEvents({ sessionId, limit, cursor }: { sessionId: string; limit: number; cursor?: PageCursor }) {
    const filter: Record<string, unknown> = { sessionId };
    if (cursor) {
      const time = new Date(cursor.time);
      if (cursor.id && ObjectId.isValid(cursor.id)) {
        filter.$or = [{ occurredAt: { $gt: time } }, { occurredAt: time, _id: { $gt: new ObjectId(cursor.id) } }];
      } else {
        filter.occurredAt = { $gt: time };
      }
    }
    const rows = await this.events.find(filter).sort({ occurredAt: 1, receivedAt: 1, _id: 1 }).limit(limit + 1).toArray();
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit);
    const items = visible.map((row) => this.toJourneyEvent(row));
    const last = visible.at(-1);
    const lastRow = visible.at(-1);
    return { items, nextCursor: hasMore && lastRow?._id && lastRow.occurredAt ? encodeCursor({ time: dateString(lastRow.occurredAt), id: lastRow._id.toString() }) : null };
  }

  async listHeatmap({ pageUrl, limit, siteId }: { pageUrl: string; limit: number; siteId?: string }) {
    const filter: Record<string, unknown> = { pageUrl, eventType: 'click' };
    if (siteId) filter.siteId = siteId;
    const rows = await this.events.find(filter).sort({ occurredAt: 1, _id: 1 }).limit(limit + 1).toArray();
    const truncated = rows.length > limit;
    const visible = rows.slice(0, limit);
    const items = visible.flatMap((row) => row.click ? [{ pageX: row.click.pageX, pageY: row.click.pageY, documentWidth: row.documentWidth, documentHeight: row.documentHeight, viewportWidth: row.viewportWidth, viewportHeight: row.viewportHeight, occurredAt: dateString(row.occurredAt) }] : []);
    return { items, count: items.length, truncated };
  }

  async listPages({ limit, siteId }: { limit: number; siteId?: string }) {
    const match: Record<string, unknown> = siteId ? { siteId } : {};
    const rows = await this.events.aggregate<{ _id: string; clickCount: number; lastSeenAt: Date }>([
      { $match: match },
      { $group: { _id: '$pageUrl', clickCount: { $sum: { $cond: [{ $eq: ['$eventType', 'click'] }, 1, 0] } }, lastSeenAt: { $max: '$occurredAt' } } },
      { $sort: { lastSeenAt: -1, _id: 1 } },
      { $limit: limit },
    ]).toArray();
    return { items: rows.map((row) => ({ pageUrl: row._id, clickCount: row.clickCount, lastSeenAt: dateString(row.lastSeenAt) })), nextCursor: null };
  }

  private toJourneyEvent(row: EventDocument): JourneyEvent {
    return {
      id: row._id?.toString() ?? row.clientEventId,
      eventType: row.eventType,
      pageUrl: row.pageUrl,
      timestamp: dateString(row.occurredAt),
      receivedAt: dateString(row.receivedAt),
      viewport: { width: row.viewportWidth, height: row.viewportHeight, devicePixelRatio: row.devicePixelRatio },
      document: { width: row.documentWidth, height: row.documentHeight },
      click: row.click ?? null,
    };
  }
}
