import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: 'teal' | 'indigo' | 'amber';
}

const toneClasses = {
  teal: 'bg-teal-50 text-teal-700 ring-teal-100',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
};

export function StatCard({ label, value, detail, icon, tone }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ${toneClasses[tone]}`}>{icon}</span>
      </div>
      <p className="mt-4 text-xs text-slate-500">{detail}</p>
    </article>
  );
}
