export interface TrackerConfig {
  endpoint: string;
  siteId?: string;
  autoPageView?: boolean;
  storageKey?: string;
  maxQueueSize?: number;
}

export interface TrackerEvent {
  sessionId: string;
  eventType: 'page_view' | 'click';
  pageUrl: string;
  timestamp: string;
  clientEventId: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  document: { width: number; height: number };
  click?: { pageX: number; pageY: number; clientX: number; clientY: number };
  siteId?: string;
}

export interface Tracker {
  readonly sessionId: string;
  trackPageView(): void;
  flush(options?: { useBeacon?: boolean }): Promise<void>;
  destroy(): void;
}

type WindowLike = Window & typeof globalThis;

const GLOBAL_KEY = '__causalFunnelTrackerInstance__';

function createUuid(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  const bytes = cryptoObject?.getRandomValues?.(new Uint8Array(16)) ?? Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizePageUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.split('#')[0];
  }
}

function getSessionId(storageKey: string): string {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
    const generated = createUuid();
    window.localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return createUuid();
  }
}

function dimensions() {
  const viewport = {
    width: Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1)),
    height: Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1)),
    devicePixelRatio: Math.max(1, Number(window.devicePixelRatio || 1)),
  };
  const root = document.documentElement;
  const body = document.body;
  return {
    viewport,
    document: {
      width: Math.max(viewport.width, root?.scrollWidth || 0, body?.scrollWidth || 0),
      height: Math.max(viewport.height, root?.scrollHeight || 0, body?.scrollHeight || 0),
    },
  };
}

class BrowserTracker implements Tracker {
  readonly sessionId: string;
  private readonly config: Required<Pick<TrackerConfig, 'endpoint' | 'storageKey' | 'maxQueueSize'>> & Pick<TrackerConfig, 'siteId' | 'autoPageView'>;
  private queue: TrackerEvent[] = [];
  private retryAttempts = new Map<string, number>();
  private sending = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;
  private readonly clickListener: (event: MouseEvent) => void;
  private readonly pageExitListener: () => void;

  constructor(config: TrackerConfig) {
    this.config = {
      endpoint: config.endpoint,
      siteId: config.siteId,
      autoPageView: config.autoPageView ?? true,
      storageKey: config.storageKey ?? 'cf_session_id',
      maxQueueSize: config.maxQueueSize ?? 100,
    };
    this.sessionId = getSessionId(this.config.storageKey);
    this.clickListener = (event) => this.recordClick(event);
    this.pageExitListener = () => { void this.flush({ useBeacon: true }); };
    document.addEventListener('click', this.clickListener, false);
    window.addEventListener('pagehide', this.pageExitListener, false);
    if (this.config.autoPageView) this.trackPageView();
  }

  trackPageView(): void {
    if (this.destroyed) return;
    this.enqueue({ eventType: 'page_view' });
  }

  async flush({ useBeacon = false }: { useBeacon?: boolean } = {}): Promise<void> {
    if (this.destroyed && !useBeacon) return;
    if (useBeacon && this.queue.length > 0 && navigator.sendBeacon) {
      const pending = [...this.queue];
      const bodyType = 'application/json';
      const sent = pending.every((event) => navigator.sendBeacon(this.config.endpoint, new Blob([JSON.stringify(event)], { type: bodyType })));
      if (sent) { this.queue = []; return; }
    }
    if (this.sending) return;
    this.sending = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];
        let response: Response;
        try {
          response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(item),
            keepalive: true,
          });
        } catch {
          this.scheduleRetry(item);
          break;
        }
        if (response.ok) {
          this.retryAttempts.delete(item.clientEventId);
          this.queue.shift();
          continue;
        }
        if (response.status >= 500) {
          this.scheduleRetry(item);
        } else {
          this.queue.shift();
          this.retryAttempts.delete(item.clientEventId);
        }
        break;
      }
    } finally {
      this.sending = false;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    document.removeEventListener('click', this.clickListener, false);
    window.removeEventListener('pagehide', this.pageExitListener, false);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if ((window as WindowLike & Record<string, unknown>)[GLOBAL_KEY] === this) delete (window as WindowLike & Record<string, unknown>)[GLOBAL_KEY];
  }

  private recordClick(event: MouseEvent): void {
    if (this.destroyed || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    this.enqueue({ eventType: 'click', click: { pageX: event.clientX + window.scrollX, pageY: event.clientY + window.scrollY, clientX: event.clientX, clientY: event.clientY } });
  }

  private enqueue(partial: Pick<TrackerEvent, 'eventType'> & Partial<Pick<TrackerEvent, 'click'>>): void {
    const { viewport, document: documentDimensions } = dimensions();
    const event: TrackerEvent = {
      sessionId: this.sessionId,
      eventType: partial.eventType,
      pageUrl: normalizePageUrl(window.location.href),
      timestamp: new Date().toISOString(),
      clientEventId: createUuid(),
      viewport,
      document: documentDimensions,
      ...(partial.click ? { click: partial.click } : {}),
      ...(this.config.siteId ? { siteId: this.config.siteId } : {}),
    };
    this.queue.push(event);
    if (this.queue.length > this.config.maxQueueSize) this.queue.splice(0, this.queue.length - this.config.maxQueueSize);
    void this.flush();
  }

  private scheduleRetry(event: TrackerEvent): void {
    const attempts = (this.retryAttempts.get(event.clientEventId) ?? 0) + 1;
    if (attempts > 3) {
      this.queue.shift();
      this.retryAttempts.delete(event.clientEventId);
      return;
    }
    this.retryAttempts.set(event.clientEventId, attempts);
    if (!this.retryTimer) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = undefined;
        void this.flush();
      }, Math.min(1_000 * 2 ** (attempts - 1), 4_000));
    }
  }
}

export function init(config: TrackerConfig): Tracker {
  const existing = (window as WindowLike & Record<string, unknown>)[GLOBAL_KEY] as Tracker | undefined;
  if (existing) return existing;
  const tracker = new BrowserTracker(config);
  (window as WindowLike & Record<string, unknown>)[GLOBAL_KEY] = tracker;
  return tracker;
}

export const CausalFunnelTracker = { init };

export default CausalFunnelTracker;
