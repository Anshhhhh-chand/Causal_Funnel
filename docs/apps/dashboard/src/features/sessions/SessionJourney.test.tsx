import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import type { JourneyEvent } from '@causalfunnel/contracts';
import { SessionJourney } from './SessionJourney';

const event: JourneyEvent = {
  id: 'event-1',
  eventType: 'click',
  pageUrl: 'https://demo.example.test/catalog',
  timestamp: '2026-10-12T10:00:00.000Z',
  receivedAt: '2026-10-12T10:00:00.010Z',
  viewport: { width: 1280, height: 800, devicePixelRatio: 2 },
  document: { width: 1280, height: 1800 },
  click: { pageX: 120, pageY: 560, clientX: 120, clientY: 560 },
};

describe('SessionJourney', () => {
  it('renders event type, page, timestamp, and coordinates', () => {
    render(<SessionJourney events={[event]} sessionId="11111111-1111-4111-8111-111111111111" />);
    expect(screen.getByText('Click')).toBeInTheDocument();
    expect(screen.getByText('demo.example.test/catalog')).toBeInTheDocument();
    expect(screen.getByText(/120, 560/)).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
  });
});
