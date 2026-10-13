import { ChartIcon } from './Icons';

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center">
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200"><ChartIcon /></span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}
