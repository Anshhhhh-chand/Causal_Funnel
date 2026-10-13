import type { JourneyEvent } from '@causalfunnel/contracts';
import { formatDate, formatPageUrl } from '../../lib/format';
import { EyeIcon } from '../../components/Icons';

interface SessionJourneyProps {
  events: JourneyEvent[];
  sessionId: string;
}

export function SessionJourney({ events, sessionId }: SessionJourneyProps) {
  return (
    <section aria-labelledby="journey-title" className="rounded-2xl border border-slate-200/80 bg-white shadow-panel">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-500">User journey</p>
          <h2 id="journey-title" className="mt-1 text-lg font-semibold text-ink">Session timeline</h2>
        </div>
        <span className="max-w-[11rem] truncate rounded-full bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-500" title={sessionId}>{sessionId.slice(0, 8)}…</span>
      </div>
      <div className="px-6 py-5">
        {events.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No events have arrived for this session yet.</p> : (
          <ol className="relative ml-2 border-l border-slate-200">
            {events.map((event, index) => <JourneyRow key={event.id} event={event} index={index} />)}
          </ol>
        )}
      </div>
    </section>
  );
}

function JourneyRow({ event, index }: { event: JourneyEvent; index: number }) {
  const isClick = event.eventType === 'click';
  return (
    <li className="relative pb-7 pl-8 last:pb-1">
      <span className={`absolute -left-[0.48rem] top-0 grid h-4 w-4 place-items-center rounded-full ring-4 ring-white ${isClick ? 'bg-amber-400' : 'bg-indigo-500'}`}>
        {isClick ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <EyeIcon className="h-2.5 w-2.5 text-white" />}
      </span>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${isClick ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>{isClick ? 'Click' : 'Page view'}</span>
            <span className="text-xs text-slate-400">Step {index + 1}</span>
          </div>
          <p className="mt-2 break-all text-sm font-medium text-ink" title={event.pageUrl}>{formatPageUrl(event.pageUrl)}</p>
          {event.click && <p className="mt-1 text-xs text-slate-500">Coordinates <span className="font-mono text-slate-700">{Math.round(event.click.pageX)}, {Math.round(event.click.pageY)}</span> px on a {event.document.width} × {event.document.height} document</p>}
        </div>
        <time className="whitespace-nowrap text-xs text-slate-400" dateTime={event.timestamp}>{formatDate(event.timestamp)}</time>
      </div>
    </li>
  );
}
