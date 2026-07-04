import { describe, it, expect } from 'vitest';
import { localWallClockToUtc, intervalsOverlap, weekdayInZone } from '@/core/time';

describe('tijdzone-correctheid (DST)', () => {
  it('09:00 lokaal in de zomer (CEST, UTC+2) = 07:00 UTC', () => {
    expect(localWallClockToUtc('2026-07-06', 9 * 60, 'Europe/Amsterdam')).toBe(
      '2026-07-06T07:00:00.000Z',
    );
  });

  it('09:00 lokaal in de winter (CET, UTC+1) = 08:00 UTC', () => {
    expect(localWallClockToUtc('2026-01-05', 9 * 60, 'Europe/Amsterdam')).toBe(
      '2026-01-05T08:00:00.000Z',
    );
  });

  it('weekdag wordt correct bepaald (2026-07-06 is een maandag = 1)', () => {
    expect(weekdayInZone('2026-07-06', 'Europe/Amsterdam')).toBe(1);
  });
});

describe('intervalsOverlap', () => {
  it('overlappende intervallen', () => {
    expect(
      intervalsOverlap(
        '2026-07-06T09:00:00Z',
        '2026-07-06T10:00:00Z',
        '2026-07-06T09:30:00Z',
        '2026-07-06T10:30:00Z',
      ),
    ).toBe(true);
  });

  it('aangrenzende intervallen overlappen niet', () => {
    expect(
      intervalsOverlap(
        '2026-07-06T09:00:00Z',
        '2026-07-06T10:00:00Z',
        '2026-07-06T10:00:00Z',
        '2026-07-06T11:00:00Z',
      ),
    ).toBe(false);
  });
});
