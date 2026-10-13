import { RefreshIcon } from './Icons';

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/70 px-6 text-center">
      <p className="text-sm font-semibold text-rose-800">We couldn’t load this view</p>
      <p className="mt-1 max-w-md text-sm text-rose-700/80">{message}</p>
      <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-rose-800 shadow-sm ring-1 ring-rose-200 transition hover:bg-rose-100" onClick={onRetry}><RefreshIcon />Try again</button>
    </div>
  );
}
