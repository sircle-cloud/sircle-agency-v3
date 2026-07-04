import { describe, it, expect } from 'vitest';
import { computeSlots } from '@/core/availability';
import type { AvailabilityRule, EventType } from '@/core/types';

const TZ = 'Europe/Amsterdam';

function rule(weekday: number): AvailabilityRule {
  return {
    id: `r${weekday}`,
    tenantId: 't',
    userId: 'u',
    weekday,
    startMinutes: 9 * 60, // 09:00
    endMinutes: 17 * 60, // 17:00
    timezone: TZ,
  };
}

const eventType: EventType = {
  id: 'et',
  tenantId: 't',
  hostUserId: 'u',
  slug: 'intake',
  name: 'Intake',
  durationMin: 30,
  slotGranularityMin: 30,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeMin: 0,
  locationType: 'video',
};

// Maandag 6 juli 2026, ruim venster.
const base = {
  eventType,
  rules: [rule(1)],
  blocked: [],
  busy: [],
  bookings: [],
  fromUtc: '2026-07-06T00:00:00.000Z',
  toUtc: '2026-07-07T00:00:00.000Z',
  nowUtc: '2026-07-01T00:00:00.000Z',
};

describe('computeSlots', () => {
  it('genereert 16 slots van 30 min tussen 09:00 en 17:00', () => {
    const slots = computeSlots(base);
    expect(slots.length).toBe(16);
    // Eerste slot = 09:00 lokaal = 07:00 UTC (zomertijd).
    expect(slots[0].startUtc).toBe('2026-07-06T07:00:00.000Z');
    // Laatste slot start = 16:30 lokaal = 14:30 UTC.
    expect(slots[slots.length - 1].startUtc).toBe('2026-07-06T14:30:00.000Z');
  });

  it('respecteert minimale aankondiging (minNotice)', () => {
    const slots = computeSlots({
      ...base,
      eventType: { ...eventType, minNoticeMin: 60 },
      // "nu" = 09:15 lokaal (07:15 UTC): slots vóór 10:15 lokaal vallen weg.
      nowUtc: '2026-07-06T07:15:00.000Z',
    });
    // Eerste toegestane start = 08:15 UTC → 08:30 UTC (10:30 lokaal) is het eerste slot-raster.
    expect(slots[0].startUtc).toBe('2026-07-06T08:30:00.000Z');
  });

  it('blokkeert slots die overlappen met bezet-tijd, inclusief buffer', () => {
    const slots = computeSlots({
      ...base,
      eventType: { ...eventType, bufferAfterMin: 15 },
      busy: [{ startUtc: '2026-07-06T09:00:00.000Z', endUtc: '2026-07-06T10:00:00.000Z' }],
    });
    // 09:00Z busy blokkeert de slots eromheen; 07:00Z (09:00 lokaal) blijft vrij,
    // maar het slot dat op 09:00Z zou beginnen en de buffer-overlap wegvallen.
    const starts = slots.map((s) => s.startUtc);
    expect(starts).not.toContain('2026-07-06T09:00:00.000Z');
    expect(starts).not.toContain('2026-07-06T08:30:00.000Z'); // 08:30-09:00 + 15 min buffer raakt busy
  });

  it('slaat geblokkeerde dagen over', () => {
    const slots = computeSlots({
      ...base,
      blocked: [{ id: 'b', tenantId: 't', userId: 'u', dateFrom: '2026-07-06', dateTo: '2026-07-06' }],
    });
    expect(slots.length).toBe(0);
  });

  it('geeft geen slots op een dag zonder beschikbaarheidsregel', () => {
    // Alleen een regel op dinsdag (2), maar het venster is maandag.
    const slots = computeSlots({ ...base, rules: [rule(2)] });
    expect(slots.length).toBe(0);
  });
});
