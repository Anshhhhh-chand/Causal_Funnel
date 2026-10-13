import type { HeatmapPoint, JourneyEvent, PageSummary, PaginatedResponse, SessionSummary } from '@causalfunnel/contracts';

const rawBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api').trim().replace(/\/+$/, '');
const API_BASE_URL = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new ApiError(response.status, body?.error?.message ?? 'The analytics service could not be reached');
  return body as T;
}

export function getSessions(): Promise<PaginatedResponse<SessionSummary>> {
  return getJson('/sessions?limit=100');
}

export function getJourney(sessionId: string): Promise<{ sessionId: string; items: JourneyEvent[]; nextCursor: string | null }> {
  return getJson(`/sessions/${encodeURIComponent(sessionId)}/events?limit=1000`);
}

export function getPages(): Promise<PaginatedResponse<PageSummary>> {
  return getJson('/pages?limit=100');
}

export function getHeatmap(pageUrl: string): Promise<{ pageUrl: string; items: HeatmapPoint[]; count: number; truncated: boolean }> {
  return getJson(`/heatmap?url=${encodeURIComponent(pageUrl)}&limit=10000`);
}

export { API_BASE_URL };
