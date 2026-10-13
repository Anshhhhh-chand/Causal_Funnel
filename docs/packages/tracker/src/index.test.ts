import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CausalFunnelTracker } from './index';

describe('browser tracker', () => {
  beforeEach(() => {
    const existing = (window as unknown as Record<string, unknown>).__causalFunnelTrackerInstance__ as { destroy?: () => void } | undefined;
    existing?.destroy?.();
    localStorage.clear();
    document.body.innerHTML = '<main style="height: 1800px"><button id="action">Action</button></main>';
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 202 })));
    window.history.replaceState({}, '', '/catalog#section');
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 40 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
  });

  it('persists one session and sends page view and page coordinates', async () => {
    const tracker = CausalFunnelTracker.init({ endpoint: '/api/events' });
    await tracker.flush();
    const sessionId = tracker.sessionId;
    const calls = vi.mocked(fetch).mock.calls;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(localStorage.getItem('cf_session_id')).toBe(sessionId);
    expect(calls[0][1]?.body).toContain('page_view');

    const button = document.querySelector('#action') as HTMLButtonElement;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 25, clientY: 35 }));
    await tracker.flush();
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body));
    expect(payload.sessionId).toBe(sessionId);
    expect(payload.pageUrl).toMatch(/\/catalog$/);
    expect(payload.click.pageX).toBe(65);
    expect(payload.click.pageY).toBe(155);
    expect(payload.viewport.devicePixelRatio).toBeGreaterThanOrEqual(1);
  });

  it('strips the fragment from the recorded page URL', async () => {
    window.history.replaceState({}, '', '/products#item-5');
    const tracker = CausalFunnelTracker.init({ endpoint: '/api/events' });
    await tracker.flush();
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload.pageUrl).toMatch(/\/products$/);
    expect(payload.pageUrl).not.toContain('#');
  });

  it('falls back to an in-memory session ID when localStorage is unavailable', async () => {
    // Browsers can disable storage, for example in private mode.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled'); });
    const tracker = CausalFunnelTracker.init({ endpoint: '/api/events' });
    expect(tracker.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    await tracker.flush();
    const payload = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload.sessionId).toBe(tracker.sessionId);
  });

  it('uses sendBeacon for pending events during pagehide', async () => {
    const beaconMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beaconMock });
    const tracker = CausalFunnelTracker.init({ endpoint: '/api/events' });
    // Leave a second event pending for the unload flush.
    tracker.trackPageView();
    await tracker.flush({ useBeacon: true });
    expect(beaconMock).toHaveBeenCalled();
    const [endpointArg] = beaconMock.mock.calls[0] as [string, Blob];
    expect(endpointArg).toBe('/api/events');
  });

  it('does not install duplicate listeners when initialized twice', async () => {
    const first = CausalFunnelTracker.init({ endpoint: '/api/events' });
    const second = CausalFunnelTracker.init({ endpoint: '/api/events' });
    expect(second).toBe(first);
    await first.flush();
    expect(vi.mocked(fetch).mock.calls.filter((call) => String(call[1]?.body).includes('page_view'))).toHaveLength(1);
  });

  it('does not throw when the transport fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    const tracker = CausalFunnelTracker.init({ endpoint: '/api/events' });
    await expect(tracker.flush()).resolves.toBeUndefined();
    expect(tracker.sessionId).toBeTruthy();
  });
});
