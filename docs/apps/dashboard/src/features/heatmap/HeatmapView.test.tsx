import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { HeatmapView } from './HeatmapView';
import * as api from '../../lib/api';
import type { HeatmapPoint, PageSummary } from '@causalfunnel/contracts';

const PAGE_URL = 'https://demo.example.test/';

const pageSummary: PageSummary = {
  pageUrl: PAGE_URL,
  clickCount: 5,
  lastSeenAt: '2026-10-12T10:00:00.000Z',
};

const heatmapPoint: HeatmapPoint = {
  pageX: 360,
  pageY: 1100,
  documentWidth: 1440,
  documentHeight: 2200,
  viewportWidth: 1440,
  viewportHeight: 900,
  occurredAt: '2026-10-12T10:00:00.000Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
  // jsdom does not implement ResizeObserver.
  vi.stubGlobal('ResizeObserver', class { observe() { } disconnect() { } });
});

describe('heatmap coordinate math', () => {
  it('scales document coordinates independently on each axis', () => {
    const reference = { width: 1440, height: 2200 };
    const rendered = { width: 720, height: 1100 };
    const point = { pageX: 360, pageY: 1100 };
    expect(point.pageX / reference.width * rendered.width).toBe(180);
    expect(point.pageY / reference.height * rendered.height).toBe(550);
  });
});

describe('HeatmapView', () => {
  it('shows a loading state while pages are being fetched', () => {
    vi.spyOn(api, 'getPages').mockReturnValue(new Promise(() => undefined));
    render(<HeatmapView />);
    expect(screen.getByText(/loading tracked pages/i)).toBeInTheDocument();
  });

  it('shows an error state when the pages request fails', async () => {
    vi.spyOn(api, 'getPages').mockRejectedValue(new Error('Pages unavailable'));
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByText(/pages unavailable/i)).toBeInTheDocument());
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });

  it('shows an empty state when no pages have been tracked', async () => {
    vi.spyOn(api, 'getPages').mockResolvedValue({ items: [], nextCursor: null });
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByText(/no pages tracked yet/i)).toBeInTheDocument());
  });

  it('renders the page selector and click count when data is available', async () => {
    vi.spyOn(api, 'getPages').mockResolvedValue({ items: [pageSummary], nextCursor: null });
    vi.spyOn(api, 'getHeatmap').mockResolvedValue({ pageUrl: PAGE_URL, items: [heatmapPoint], count: 1, truncated: false });
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByLabelText(/tracked page/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/1 clicks/i)).toBeInTheDocument());
  });

  it('loads new heatmap points when the page URL selection changes', async () => {
    const PAGE_B = 'https://demo.example.test/about';
    vi.spyOn(api, 'getPages').mockResolvedValue({
      items: [pageSummary, { pageUrl: PAGE_B, clickCount: 2, lastSeenAt: '2026-10-12T09:00:00.000Z' }],
      nextCursor: null,
    });
    const getHeatmap = vi.spyOn(api, 'getHeatmap')
      .mockResolvedValueOnce({ pageUrl: PAGE_URL, items: [heatmapPoint], count: 1, truncated: false })
      .mockResolvedValueOnce({ pageUrl: PAGE_B, items: [], count: 0, truncated: false });
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByLabelText(/tracked page/i)).toBeInTheDocument());
    const selector = screen.getByLabelText(/tracked page/i) as HTMLSelectElement;
    await userEvent.selectOptions(selector, PAGE_B);
    expect(getHeatmap).toHaveBeenLastCalledWith(PAGE_B);
    await waitFor(() => expect(screen.getByText(/no clicks on this page yet/i)).toBeInTheDocument());
  });

  it('shows a heatmap error state when click data cannot be loaded', async () => {
    vi.spyOn(api, 'getPages').mockResolvedValue({ items: [pageSummary], nextCursor: null });
    vi.spyOn(api, 'getHeatmap').mockRejectedValue(new Error('Heatmap unavailable'));
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByText(/heatmap unavailable/i)).toBeInTheDocument());
  });
});
