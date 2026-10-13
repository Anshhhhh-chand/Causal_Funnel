export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function shortId(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function formatPageUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value;
  }
}
