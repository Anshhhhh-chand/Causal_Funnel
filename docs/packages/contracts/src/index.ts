export const EVENT_TYPES = ['page_view', 'click'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface ViewportDimensions {
  width: number;
  height: number;
  devicePixelRatio?: number;
}

export interface DocumentDimensions {
  width: number;
  height: number;
}

export interface ClickCoordinates {
  pageX: number;
  pageY: number;
  clientX?: number;
  clientY?: number;
}

export interface ClientEvent {
  sessionId: string;
  eventType: EventType;
  pageUrl: string;
  timestamp: string;
  clientEventId: string;
  viewport: ViewportDimensions;
  document: DocumentDimensions;
  click?: ClickCoordinates;
  siteId?: string;
}

export interface SessionSummary {
  sessionId: string;
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface JourneyEvent {
  id: string;
  eventType: EventType;
  pageUrl: string;
  timestamp: string;
  receivedAt: string;
  viewport: ViewportDimensions;
  document: DocumentDimensions;
  click: ClickCoordinates | null;
}

export interface HeatmapPoint {
  pageX: number;
  pageY: number;
  documentWidth: number;
  documentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  occurredAt: string;
}

export interface PageSummary {
  pageUrl: string;
  clickCount: number;
  lastSeenAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}
