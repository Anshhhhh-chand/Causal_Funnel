import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SessionsView } from './SessionsView';
import * as api from '../../lib/api';
import type { JourneyEvent, SessionSummary } from '@causalfunnel/contracts';

const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

const sessionA: SessionSummary = {
  sessionId: SESSION_A,
  eventCount: 3,
  firstSeenAt: '2026-10-12T10:00:00.000Z',
  lastSeenAt: '2026-10-12T10:01:00.000Z',
};

const sessionB: SessionSummary = {
  sessionId: SESSION_B,
  eventCount: 1,
  firstSeenAt: '2026-10-12T09:50:00.000Z',
  lastSeenAt: '2026-10-12T09:51:00.000Z',
};

const journeyEvent: JourneyEvent = {
  id: 'evt-1',
  eventType: 'page_view',
  pageUrl: 'https://demo.example.test/shop',
  timestamp: '2026-10-12T10:00:00.000Z',
  receivedAt: '2026-10-12T10:00:00.010Z',
  viewport: { width: 1280, height: 800, devicePixelRatio: 2 },
  document: { width: 1280, height: 1800 },
  click: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SessionsView', () => {
  it('shows a loading state while sessions are being fetched', () => {
    vi.spyOn(api, 'getSessions').mockReturnValue(new Promise(() => undefined));
    render(<SessionsView onStatsChange={() => undefined} />);
    expect(screen.getByText(/loading sessions/i)).toBeInTheDocument();
  });

  it('shows an error state when the sessions request fails', async () => {
    vi.spyOn(api, 'getSessions').mockRejectedValue(new Error('Network error'));
    render(<SessionsView onStatsChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
    expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no sessions', async () => {
    vi.spyOn(api, 'getSessions').mockResolvedValue({ items: [], nextCursor: null });
    render(<SessionsView onStatsChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument());
  });

  it('renders the session table with event counts', async () => {
    vi.spyOn(api, 'getSessions').mockResolvedValue({ items: [sessionA, sessionB], nextCursor: null });
    vi.spyOn(api, 'getJourney').mockResolvedValue({ sessionId: SESSION_A, items: [], nextCursor: null });
    render(<SessionsView onStatsChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('calls onStatsChange with session and event totals', async () => {
    vi.spyOn(api, 'getSessions').mockResolvedValue({ items: [sessionA, sessionB], nextCursor: null });
    vi.spyOn(api, 'getJourney').mockResolvedValue({ sessionId: SESSION_A, items: [], nextCursor: null });
    const onStatsChange = vi.fn();
    render(<SessionsView onStatsChange={onStatsChange} />);
    await waitFor(() => expect(onStatsChange).toHaveBeenCalledWith({ sessions: 2, events: 4 }));
  });

  it('loads the journey when a session row is clicked', async () => {
    const getJourney = vi.spyOn(api, 'getJourney').mockResolvedValue({ sessionId: SESSION_A, items: [journeyEvent], nextCursor: null });
    vi.spyOn(api, 'getSessions').mockResolvedValue({ items: [sessionA], nextCursor: null });
    render(<SessionsView onStatsChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    const rows = screen.getAllByRole('row');
    const sessionRow = rows.find((r) => r.textContent?.includes('3'))!;
    await userEvent.click(sessionRow);
    expect(getJourney).toHaveBeenCalledWith(SESSION_A);
    await waitFor(() => expect(screen.getByText(/demo.example.test\/shop/i)).toBeInTheDocument());
  });

  it('shows a journey error state when the journey request fails', async () => {
    vi.spyOn(api, 'getSessions').mockResolvedValue({ items: [sessionA], nextCursor: null });
    vi.spyOn(api, 'getJourney').mockRejectedValue(new Error('Journey unavailable'));
    render(<SessionsView onStatsChange={() => undefined} />);
    await waitFor(() => expect(screen.getByText(/journey unavailable/i)).toBeInTheDocument());
  });
});
