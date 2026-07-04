import { describe, it, expect } from 'vitest';
import { BookingService } from '@/core/booking';
import { MemoryRepository } from '@/adapters/repo/memory';
import { MockCalendar } from '@/adapters/calendar/mock';
import { ConsoleMailer } from '@/adapters/mail/console';
import { buildSeed } from '@/adapters/seed';
import { SlotUnavailableError } from '@/core/errors';

let n = 0;
const id = () => `rr_${++n}`;
const NOW = '2026-07-01T00:00:00.000Z';
const SLOT_A = '2026-07-06T07:00:00.000Z';
const SLOT_B = '2026-07-06T07:30:00.000Z';

function build() {
  const seed = buildSeed();
  // Tweede host Anna met dezelfde werktijden.
  seed.users.push({ id: 'u_anna', tenantId: 't_sircle', email: 'anna@sircle.example', name: 'Anna' });
  for (const wd of [1, 2, 3, 4, 5]) {
    seed.rules.push({
      id: `ar_anna_${wd}`,
      tenantId: 't_sircle',
      userId: 'u_anna',
      weekday: wd,
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      timezone: 'Europe/Amsterdam',
    });
  }
  // Round-robin afspraaktype over Koen + Anna.
  seed.eventTypes.push({
    id: 'et_rr',
    tenantId: 't_sircle',
    hostUserId: 'u_koen',
    hostUserIds: ['u_koen', 'u_anna'],
    slug: 'rr',
    name: 'Team call',
    durationMin: 30,
    slotGranularityMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    minNoticeMin: 0,
    locationType: 'video',
  });
  const repo = new MemoryRepository(seed);
  const service = new BookingService(repo, new MockCalendar(), new ConsoleMailer(), id);
  return { repo, service };
}

function book(service: BookingService, startUtc: string) {
  return service.createBooking({
    tenantSlug: 'sircle',
    eventTypeSlug: 'rr',
    guestName: 'Gast',
    guestEmail: `g${Math.round(Math.random() * 1e9)}@example.com`,
    guestTimezone: 'Europe/Amsterdam',
    startUtc,
    nowUtc: NOW,
  });
}

describe('Round-robin scheduling', () => {
  it('wijst twee boekingen op hetzelfde tijdstip toe aan verschillende hosts', async () => {
    const { service } = build();
    const b1 = await book(service, SLOT_A);
    const b2 = await book(service, SLOT_A);
    expect(b1.hostUserId).not.toBe(b2.hostUserId);
    expect(new Set([b1.hostUserId, b2.hostUserId])).toEqual(new Set(['u_koen', 'u_anna']));
  });

  it('weigert een derde boeking op hetzelfde tijdstip (beide hosts bezet)', async () => {
    const { service } = build();
    await book(service, SLOT_A);
    await book(service, SLOT_A);
    await expect(book(service, SLOT_A)).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('verdeelt eerlijk: de host met minste boekingen krijgt de volgende', async () => {
    const { service } = build();
    const first = await book(service, SLOT_A); // → Koen (stabiele tie-break)
    expect(first.hostUserId).toBe('u_koen');
    const second = await book(service, SLOT_B); // beide vrij, Koen heeft er al 1 → Anna
    expect(second.hostUserId).toBe('u_anna');
  });

  it('toont het slot zolang minstens één host vrij is (unie)', async () => {
    const { service } = build();
    await book(service, SLOT_A); // 1 van 2 hosts bezet op A
    const { slots } = await service.listAvailableSlots({
      tenantSlug: 'sircle',
      eventTypeSlug: 'rr',
      fromUtc: '2026-07-06T00:00:00.000Z',
      toUtc: '2026-07-07T00:00:00.000Z',
      nowUtc: NOW,
    });
    expect(slots.map((s) => s.startUtc)).toContain(SLOT_A); // nog steeds beschikbaar
  });
});
