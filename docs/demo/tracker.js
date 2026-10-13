"use strict";
var CausalFunnelTracker = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    CausalFunnelTracker: () => CausalFunnelTracker,
    default: () => index_default,
    init: () => init
  });
  var GLOBAL_KEY = "__causalFunnelTrackerInstance__";
  function createUuid() {
    const cryptoObject = globalThis.crypto;
    if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
    const bytes = cryptoObject?.getRandomValues?.(new Uint8Array(16)) ?? Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    bytes[6] = bytes[6] & 15 | 64;
    bytes[8] = bytes[8] & 63 | 128;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function normalizePageUrl(value) {
    try {
      const url = new URL(value);
      url.hash = "";
      return url.toString();
    } catch {
      return value.split("#")[0];
    }
  }
  function getSessionId(storageKey) {
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
      devicePixelRatio: Math.max(1, Number(window.devicePixelRatio || 1))
    };
    const root = document.documentElement;
    const body = document.body;
    return {
      viewport,
      document: {
        width: Math.max(viewport.width, root?.scrollWidth || 0, body?.scrollWidth || 0),
        height: Math.max(viewport.height, root?.scrollHeight || 0, body?.scrollHeight || 0)
      }
    };
  }
  var BrowserTracker = class {
    sessionId;
    config;
    queue = [];
    retryAttempts = /* @__PURE__ */ new Map();
    sending = false;
    retryTimer;
    destroyed = false;
    clickListener;
    pageExitListener;
    constructor(config) {
      this.config = {
        endpoint: config.endpoint,
        siteId: config.siteId,
        autoPageView: config.autoPageView ?? true,
        storageKey: config.storageKey ?? "cf_session_id",
        maxQueueSize: config.maxQueueSize ?? 100
      };
      this.sessionId = getSessionId(this.config.storageKey);
      this.clickListener = (event) => this.recordClick(event);
      this.pageExitListener = () => {
        void this.flush({ useBeacon: true });
      };
      document.addEventListener("click", this.clickListener, false);
      window.addEventListener("pagehide", this.pageExitListener, false);
      if (this.config.autoPageView) this.trackPageView();
    }
    trackPageView() {
      if (this.destroyed) return;
      this.enqueue({ eventType: "page_view" });
    }
    async flush({ useBeacon = false } = {}) {
      if (this.destroyed && !useBeacon) return;
      if (useBeacon && this.queue.length > 0 && navigator.sendBeacon) {
        const pending = [...this.queue];
        const bodyType = "application/json";
        const sent = pending.every((event) => navigator.sendBeacon(this.config.endpoint, new Blob([JSON.stringify(event)], { type: bodyType })));
        if (sent) {
          this.queue = [];
          return;
        }
      }
      if (this.sending) return;
      this.sending = true;
      try {
        while (this.queue.length > 0) {
          const item = this.queue[0];
          let response;
          try {
            response = await fetch(this.config.endpoint, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(item),
              keepalive: true
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
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      document.removeEventListener("click", this.clickListener, false);
      window.removeEventListener("pagehide", this.pageExitListener, false);
      if (this.retryTimer) clearTimeout(this.retryTimer);
      if (window[GLOBAL_KEY] === this) delete window[GLOBAL_KEY];
    }
    recordClick(event) {
      if (this.destroyed || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      this.enqueue({ eventType: "click", click: { pageX: event.clientX + window.scrollX, pageY: event.clientY + window.scrollY, clientX: event.clientX, clientY: event.clientY } });
    }
    enqueue(partial) {
      const { viewport, document: documentDimensions } = dimensions();
      const event = {
        sessionId: this.sessionId,
        eventType: partial.eventType,
        pageUrl: normalizePageUrl(window.location.href),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        clientEventId: createUuid(),
        viewport,
        document: documentDimensions,
        ...partial.click ? { click: partial.click } : {},
        ...this.config.siteId ? { siteId: this.config.siteId } : {}
      };
      this.queue.push(event);
      if (this.queue.length > this.config.maxQueueSize) this.queue.splice(0, this.queue.length - this.config.maxQueueSize);
      void this.flush();
    }
    scheduleRetry(event) {
      const attempts = (this.retryAttempts.get(event.clientEventId) ?? 0) + 1;
      if (attempts > 3) {
        this.queue.shift();
        this.retryAttempts.delete(event.clientEventId);
        return;
      }
      this.retryAttempts.set(event.clientEventId, attempts);
      if (!this.retryTimer) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = void 0;
          void this.flush();
        }, Math.min(1e3 * 2 ** (attempts - 1), 4e3));
      }
    }
  };
  function init(config) {
    const existing = window[GLOBAL_KEY];
    if (existing) return existing;
    const tracker = new BrowserTracker(config);
    window[GLOBAL_KEY] = tracker;
    return tracker;
  }
  var CausalFunnelTracker = { init };
  var index_default = CausalFunnelTracker;
  return __toCommonJS(index_exports);
})();
