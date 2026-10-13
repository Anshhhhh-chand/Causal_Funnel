import type { SessionSummary } from '@causalfunnel/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { RefreshIcon } from '../../components/Icons';
import { getJourney, getSessions } from '../../lib/api';
import { formatDate, formatNumber, shortId } from '../../lib/format';
import { SessionJourney } from './SessionJourney';

interface SessionsViewProps {
  onStatsChange: (stats: { sessions: number; events: number }) => void;
}

export function SessionsView({ onStatsChange }: SessionsViewProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [journey, setJourney] = useState<Awaited<ReturnType<typeof getJourney>>['items']>([]);
  const [loading, setLoading] = useState(true);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journeyError, setJourneyError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getSessions();
      setSessions(response.items);
      onStatsChange({ sessions: response.items.length, events: response.items.reduce((sum, session) => sum + session.eventCount, 0) });
      setSelectedId((current) => current && response.items.some((item) => item.sessionId === current) ? current : response.items[0]?.sessionId ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The session list is unavailable');
    } finally {
      setLoading(false);
    }
  }, [onStatsChange]);

  const loadJourney = useCallback(async (sessionId: string) => {
    setJourneyLoading(true);
    setJourneyError(null);
    try {
      const response = await getJourney(sessionId);
      setJourney(response.items);
    } catch (reason) {
      setJourneyError(reason instanceof Error ? reason.message : 'This session is unavailable');
    } finally {
      setJourneyLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (selectedId) void loadJourney(selectedId);
    else setJourney([]);
  }, [loadJourney, selectedId]);

  const selectedSession = useMemo(() => sessions.find((session) => session.sessionId === selectedId) ?? null, [sessions, selectedId]);

  if (loading) return <LoadingState label="Loading sessions…" />;
  if (error) return <ErrorState message={error} onRetry={() => void loadSessions()} />;
  if (sessions.length === 0) return <EmptyState title="No sessions yet" message="Open the demo page and interact with it to see live session activity here." />;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
      <section aria-labelledby="sessions-title" className="rounded-2xl border border-slate-200/80 bg-white shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-600">Audience activity</p><h2 id="sessions-title" className="mt-1 text-lg font-semibold text-ink">Recent sessions</h2></div>
          <button onClick={() => void loadSessions()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"><RefreshIcon />Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-6 py-3">Session</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Last seen</th><th className="px-6 py-3 text-right">Open</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((session) => <SessionRow key={session.sessionId} session={session} active={session.sessionId === selectedId} onSelect={() => setSelectedId(session.sessionId)} />)}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-6 py-4 text-xs text-slate-400">Showing {sessions.length} most recent sessions</p>
      </section>
      {journeyLoading ? <LoadingState label="Loading journey…" /> : journeyError ? <ErrorState message={journeyError} onRetry={() => selectedId && void loadJourney(selectedId)} /> : selectedSession ? <SessionJourney events={journey} sessionId={selectedSession.sessionId} /> : <EmptyState title="Choose a session" message="Select a row to inspect the user's journey." />}
    </div>
  );
}

function SessionRow({ session, active, onSelect }: { session: SessionSummary; active: boolean; onSelect: () => void }) {
  return <tr className={`group cursor-pointer transition ${active ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`} onClick={onSelect} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }}><td className="px-6 py-4"><div className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${active ? 'bg-indigo-500' : 'bg-teal-400'}`} /><span className="font-mono text-xs font-medium text-ink" title={session.sessionId}>{shortId(session.sessionId)}</span></div><p className="mt-1 pl-5 text-xs text-slate-400">First seen {formatDate(session.firstSeenAt)}</p></td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{formatNumber(session.eventCount)}</span></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{formatDate(session.lastSeenAt)}</td><td className="px-6 py-4 text-right"><span className={`text-xs font-semibold ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'}`}>View →</span></td></tr>;
}
