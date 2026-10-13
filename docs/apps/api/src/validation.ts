import { EVENT_TYPES, type ClientEvent, type EventType } from '@causalfunnel/contracts';
import { z } from 'zod';

const MAX_URL_LENGTH = 2_048;
const MAX_DIMENSION = 1_000_000;

const dimensionSchema = z.object({
  width: z.number().finite().positive().max(MAX_DIMENSION),
  height: z.number().finite().positive().max(MAX_DIMENSION),
});

const viewportSchema = dimensionSchema.extend({
  devicePixelRatio: z.number().finite().positive().max(20).optional(),
});

const clickSchema = z.object({
  pageX: z.number().finite().nonnegative().max(MAX_DIMENSION),
  pageY: z.number().finite().nonnegative().max(MAX_DIMENSION),
  clientX: z.number().finite().nonnegative().max(MAX_DIMENSION).optional(),
  clientY: z.number().finite().nonnegative().max(MAX_DIMENSION).optional(),
});

export const rawEventSchema = z
  .object({
    sessionId: z.string().uuid(),
    eventType: z.enum(EVENT_TYPES),
    pageUrl: z.string().min(1).max(MAX_URL_LENGTH),
    timestamp: z.string().datetime({ offset: true }),
    clientEventId: z.string().uuid(),
    viewport: viewportSchema,
    document: dimensionSchema,
    click: clickSchema.optional(),
    siteId: z.string().min(1).max(100).optional(),
  })
  .strict()
  .superRefine((event, context) => {
    if (event.eventType === 'click' && !event.click) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['click'], message: 'Click coordinates are required for click events' });
    }
    if (event.eventType === 'page_view' && event.click) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['click'], message: 'Click coordinates are only valid for click events' });
    }
    if (event.click && event.click.pageX > event.document.width + 16) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['click', 'pageX'], message: 'pageX exceeds document width' });
    }
    if (event.click && event.click.pageY > event.document.height + 16) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['click', 'pageY'], message: 'pageY exceeds document height' });
    }
  });

export interface NormalizedEvent extends ClientEvent {
  pageUrl: string;
}

export function normalizePageUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP(S) page URLs are accepted');
  }
  url.hash = '';
  return url.toString();
}

export function validateAndNormalizeEvent(input: unknown, maxEventAgeHours: number): NormalizedEvent {
  const parsed = rawEventSchema.parse(input);
  let pageUrl: string;
  try {
    pageUrl = normalizePageUrl(parsed.pageUrl);
  } catch {
    throw new z.ZodError([
      { code: z.ZodIssueCode.custom, path: ['pageUrl'], message: 'pageUrl must be an absolute HTTP(S) URL' },
    ]);
  }
  const timestamp = new Date(parsed.timestamp);
  const ageMs = Math.abs(Date.now() - timestamp.getTime());
  if (ageMs > maxEventAgeHours * 60 * 60 * 1000) {
    throw new z.ZodError([
      { code: z.ZodIssueCode.custom, path: ['timestamp'], message: 'timestamp is outside the accepted clock-skew window' },
    ]);
  }
  return { ...parsed, pageUrl } as NormalizedEvent;
}

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}
