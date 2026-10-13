import type { HeatmapPoint, PageSummary } from '@causalfunnel/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { getHeatmap, getPages } from '../../lib/api';
import { formatNumber } from '../../lib/format';
import { CursorIcon, RefreshIcon } from '../../components/Icons';

export function HeatmapView() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [clickCount, setClickCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    setLoadingPages(true);
    setError(null);
    try {
      const response = await getPages();
      setPages(response.items);
      setSelectedUrl((current) => current || response.items[0]?.pageUrl || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Page data is unavailable');
    } finally {
      setLoadingPages(false);
    }
  }, []);

  const loadPoints = useCallback(async (pageUrl: string) => {
    setLoadingPoints(true);
    setPointsError(null);
    try {
      const response = await getHeatmap(pageUrl);
      setPoints(response.items);
      setClickCount(response.count);
      setTruncated(response.truncated);
    } catch (reason) {
      setPointsError(reason instanceof Error ? reason.message : 'Heatmap data is unavailable');
      setPoints([]);
    } finally {
      setLoadingPoints(false);
    }
  }, []);

  useEffect(() => { void loadPages(); }, [loadPages]);
  useEffect(() => { if (selectedUrl) void loadPoints(selectedUrl); }, [loadPoints, selectedUrl]);

  if (loadingPages) return <LoadingState label="Loading tracked pages…" />;
  if (error) return <ErrorState message={error} onRetry={() => void loadPages()} />;
  if (pages.length === 0) return <EmptyState title="No pages tracked yet" message="Generate activity from the demo page, then return here to explore click behavior." />;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">Interaction map</p><h2 className="mt-1 text-lg font-semibold text-ink">Where visitors click</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Coordinates are measured in CSS pixels from the top-left of the original document.</p></div>
          <div className="flex w-full items-end gap-3 lg:max-w-xl"><label className="min-w-0 flex-1"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tracked page</span><select aria-label="Tracked page" value={selectedUrl} onChange={(event) => setSelectedUrl(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">{pages.map((page) => <option key={page.pageUrl} value={page.pageUrl}>{page.pageUrl}</option>)}</select></label><button onClick={() => void loadPoints(selectedUrl)} className="mb-0.5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"><RefreshIcon />Refresh</button></div>
        </div>
      </div>
      {loadingPoints ? <LoadingState label="Plotting clicks…" /> : pointsError ? <ErrorState message={pointsError} onRetry={() => void loadPoints(selectedUrl)} /> : <HeatmapCard pageUrl={selectedUrl} points={points} clickCount={clickCount} truncated={truncated} />}
    </section>
  );
}

function HeatmapCard({ pageUrl, points, clickCount, truncated }: { pageUrl: string; points: HeatmapPoint[]; clickCount: number; truncated: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const reference = useMemo(() => chooseReferenceDimensions(points), [points]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const update = () => setWidth(node.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const renderedHeight = width > 0 ? Math.max(320, Math.round(width * reference.height / reference.width)) : 560;
  const isDemo = isDemoPage(pageUrl);
  const hasMixedDimensions = hasMixedDocumentDimensions(points);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5"><div className="min-w-0"><p className="break-all text-sm font-medium text-ink" title={pageUrl}>{pageUrl}</p><p className="mt-1 text-xs text-slate-500">Reference document {reference.width} × {reference.height} CSS px{truncated ? ' · Showing the first 10,000 clicks' : ''}</p></div><div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"><CursorIcon className="h-4 w-4" />{formatNumber(clickCount)} clicks</div></div>
      <div ref={containerRef} className="relative mx-6 my-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ height: renderedHeight }}>
        {isDemo ? <DemoPagePreview /> : <CoordinateGrid />}
        {points.map((point, index) => { const left = Math.min(100, Math.max(0, point.pageX / reference.width * 100)); const top = Math.min(100, Math.max(0, point.pageY / reference.height * 100)); return <span key={`${point.occurredAt}-${index}`} title={`Click ${Math.round(point.pageX)}, ${Math.round(point.pageY)}`} className="absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rose-500/85 shadow-[0_0_0_5px_rgba(244,63,94,0.16)]" style={{ left: `${left}%`, top: `${top}%` }} />; })}
        {points.length === 0 && <div className="absolute inset-0 z-20 grid place-items-center"><div className="rounded-xl bg-white/90 px-5 py-4 text-center shadow-lg ring-1 ring-slate-200"><p className="text-sm font-semibold text-ink">No clicks on this page yet</p><p className="mt-1 text-xs text-slate-500">Interact with the page to populate the map.</p></div></div>}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 px-6 py-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500 ring-4 ring-rose-100" />Recorded click</span><span>Dots scale with the heatmap surface as the browser resizes.</span>{isDemo && <span className="font-medium text-teal-700">Demo page preview aligned to the tracked surface.</span>}{hasMixedDimensions && <span className="font-medium text-amber-700">Mixed document sizes detected; dots use the most common reference.</span>}</div>
    </div>
  );
}

function chooseReferenceDimensions(points: HeatmapPoint[]) {
  if (points.length === 0) return { width: 1440, height: 2200 };
  const counts = new Map<string, { width: number; height: number; count: number }>();
  for (const point of points) { const key = `${point.documentWidth}x${point.documentHeight}`; const current = counts.get(key); counts.set(key, current ? { ...current, count: current.count + 1 } : { width: point.documentWidth, height: point.documentHeight, count: 1 }); }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0];
}

function hasMixedDocumentDimensions(points: HeatmapPoint[]) {
  return new Set(points.map((point) => `${point.documentWidth}x${point.documentHeight}`)).size > 1;
}

function isDemoPage(pageUrl: string) {
  try { return new URL(pageUrl).pathname.includes('/demo/'); } catch { return false; }
}

function DemoPagePreview() {
  return <div className="absolute inset-0 overflow-hidden bg-[#f7f8fc] text-[#10233f]"><div className="h-[12%] border-b border-slate-200 bg-white px-[5%] py-[2%]"><div className="h-2 w-[18%] rounded-full bg-[#10233f]" /><div className="mt-3 flex gap-2"><span className="h-1.5 w-[8%] rounded-full bg-slate-200" /><span className="h-1.5 w-[8%] rounded-full bg-slate-200" /><span className="h-1.5 w-[8%] rounded-full bg-slate-200" /></div></div><div className="mx-[5%] mt-[7%] h-[26%] rounded-[2%] bg-gradient-to-br from-[#10233f] via-[#1a3f61] to-[#1cc8c5] p-[6%]"><div className="h-2 w-[48%] rounded-full bg-white/90" /><div className="mt-3 h-1.5 w-[65%] rounded-full bg-white/30" /><div className="mt-5 h-7 w-[21%] rounded-lg bg-white/90" /></div><div className="mx-[5%] mt-[7%] grid grid-cols-3 gap-[2%]"><span className="h-32 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" /><span className="h-32 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" /><span className="h-32 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" /></div><div className="mx-[5%] mt-[7%] h-[32%] rounded-2xl bg-white p-[5%] shadow-sm ring-1 ring-slate-200"><div className="h-2 w-[38%] rounded-full bg-[#10233f]" /><div className="mt-4 h-1.5 w-[80%] rounded-full bg-slate-200" /><div className="mt-2 h-1.5 w-[70%] rounded-full bg-slate-200" /><div className="mt-2 h-1.5 w-[74%] rounded-full bg-slate-200" /></div></div>;
}

function CoordinateGrid() {
  return <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:48px_48px]"><div className="absolute left-5 top-5 rounded-lg bg-white/85 px-3 py-2 text-xs text-slate-500 shadow-sm ring-1 ring-slate-200">Coordinate reference surface</div></div>;
}
