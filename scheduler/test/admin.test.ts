import { describe, it, expect } from 'vitest';
import { AdminService } from '@/core/admin';
import { BookingService } from '@/core/booking';
import { MemoryRepository } from '@/adapters/repo/memory';
import { MockCalendar } from '@/adapters/calendar/mock';
import { ConsoleMailer } from '@/adapters/mail/console';

let n = 0;
const id = () => `x_${++n}`;

function build() {
  const repo = new MemoryRepository();
  const calendar = new MockCalendar();
  const admin = new AdminService(repo, calendar, id);
  const booking = new BookingService(repo, calendar, new ConsoleMailer(), id);
  return { repo, admin, booking };
}

describe('AdminService', () => {
  it('maakt een afspraaktype aan en toont het in de lijst', async () => {
    const { admin } = build();
    await admin.saveEventType({
      tenantId: 't_sircle',
      hostUserId: 'u_koen',
      slug: 'demo-call',
      name: 'Demo call',
      durationMin: 45,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 60,
      locationType: 'video',
    });
    const list = await admin.listEventTypes('t_sircle');
    expect(list.some((e) => e.slug === 'demo-call' && e.durationMin === 45)).toBe(true);
  });

  it('weigert een ongeldige slug', async () => {
    const { admin } = build();
    await expect(
      admin.saveEventType({
        tenantId: 't_sircle',
        hostUserId: 'u_koen',
        slug: 'Ongeldige Slug!',
        name: 'X',
        durationMin: 30,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        minNoticeMin: 0,
        locationType: 'video',
      }),
    ).rejects.toThrow();
  });

  it('vervangt de wekelijkse beschikbaarheid', async () => {
    const { admin } = build();
    await admin.saveAvailability('t_sircle', 'u_koen', 'Europe/Amsterdam', [
      { weekday: 1, start: '10:00', end: '12:00' },
    ]);
    const rules = await admin.getAvailability('t_sircle', 'u_koen');
    expect(rules.length).toBe(1);
    expect(rules[0].startMinutes).toBe(600);
    expect(rules[0].endMinutes).toBe(720);
  });

  it('annuleert een boeking en maakt het slot weer beschikbaar', async () => {
    const { admin, booking } = build();
    const window = {
      tenantSlug: 'sircle',
      eventTypeSlug: 'intake',
      fromUtc: '2026-07-06T00:00:00.000Z',
      toUtc: '2026-07-07T00:00:00.000Z',
      nowUtc: '2026-07-01T00:00:00.000Z',
    };
    const { slots } = await booking.listAvailableSlots(window);
    const start = slots[0].startUtc;
    const made = await booking.createBooking({
      tenantSlug: 'sircle',
      eventTypeSlug: 'intake',
      guestName: 'Gast',
      guestEmail: 'gast@example.com',
      guestTimezone: 'Europe/Amsterdam',
      startUtc: start,
      nowUtc: window.nowUtc,
    });

    // Na annuleren is het slot weer vrij.
    await admin.cancelBooking('t_sircle', made.id);
    const after = await booking.listAvailableSlots(window);
    expect(after.slots.map((s) => s.startUtc)).toContain(start);
  });
});
