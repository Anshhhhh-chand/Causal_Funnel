export function LoadingState({ label = 'Loading analytics…' }: { label?: string }) {
  return <div className="flex min-h-56 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 shadow-panel"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />{label}</div>;
}
