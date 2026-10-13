interface IconProps { className?: string }

export function ChartIcon({ className = 'h-5 w-5' }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V5m0 14h16M8 16v-4m4 4V7m4 9v-6m4 6V4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function CursorIcon({ className = 'h-5 w-5' }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 3 3.1 15.2 3.7-4.1 5.2 5.9 2-1.7-5.2-5.9 5.2-.9L5 3Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function UsersIcon({ className = 'h-5 w-5' }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.5-3.2 2.3-5 5.5-5s5 1.8 5.5 5M16 11a3 3 0 1 0 0-6m1 10c2.1.1 3.5 1.7 4 4" strokeLinecap="round" /></svg>;
}

export function RefreshIcon({ className = 'h-4 w-4' }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10m0-4v4h4M4 13a8.1 8.1 0 0 0 14.8 4L21 14m0 4v-4h-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ArrowIcon({ className = 'h-4 w-4' }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function EyeIcon({ className = 'h-4 w-4' }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}
