import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { ChartIcon, CursorIcon, UsersIcon } from './components/Icons';
import { StatCard } from './components/StatCard';
import { HeatmapView } from './features/heatmap/HeatmapView';
import { SessionsView } from './features/sessions/SessionsView';
import { formatNumber } from './lib/format';

type View = 'sessions' | 'heatmap';

export function App() {
  const [view, setView] = useState<View>('sessions');
  const [stats, setStats] = useState({ sessions: 0, events: 0 });
  const updateStats = useCallback((next: typeof stats) => setStats(next), []);
  return (
    <div className="min-h-screen bg-mist text-ink">
      <header className="border-b border-slate-200/80 bg-white"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-cyanbrand shadow-sm"><ChartIcon /></div><div><p className="text-sm font-bold tracking-tight text-ink">Funnel Lens</p><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">User analytics</p></div></div><div className="flex items-center gap-3 text-xs text-slate-500"><span className="hidden rounded-full bg-teal-50 px-3 py-1.5 font-semibold text-teal-700 sm:inline-flex sm:items-center sm:gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" />Live collection</span><span className="rounded-full border border-slate-200 px-3 py-1.5">Local workspace</span></div></div></header>
      <main className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8 lg:py-10"><div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-sm font-semibold text-indigo-600">Good morning, analyst</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Understand every interaction.</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">A focused view of real-time sessions and click behavior across your tracked pages.</p></div><nav aria-label="Analytics views" className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><NavButton active={view === 'sessions'} onClick={() => setView('sessions')} icon={<UsersIcon />} label="Sessions" /><NavButton active={view === 'heatmap'} onClick={() => setView('heatmap')} icon={<CursorIcon />} label="Heatmap" /></nav></div>
        <div className="mb-7 grid gap-4 sm:grid-cols-3"><StatCard label="Tracked sessions" value={formatNumber(stats.sessions)} detail="Distinct browser sessions" icon={<UsersIcon />} tone="indigo" /><StatCard label="Events captured" value={formatNumber(stats.events)} detail="Page views + interactions" icon={<ChartIcon />} tone="teal" /><StatCard label="Collection status" value="Live" detail="Events are arriving from the demo" icon={<span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_0_5px_rgba(251,191,36,0.18)]" />} tone="amber" /></div>
        {view === 'sessions' ? <SessionsView onStatsChange={updateStats} /> : <HeatmapView />}
      </main>
      <footer className="mx-auto max-w-[1500px] px-5 pb-8 text-xs text-slate-400 lg:px-8">Funnel Lens · Coordinates are recorded in browser CSS pixels for reliable cross-size rendering.</footer>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button aria-current={active ? 'page' : undefined} onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? 'bg-ink text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-ink'}`}>{icon}<span>{label}</span></button>;
}
