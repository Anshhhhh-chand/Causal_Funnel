import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from './index';

describe('shared contracts', () => {
  it('keeps the assignment event types intentionally small', () => {
    expect(EVENT_TYPES).toEqual(['page_view', 'click']);
  });
});
