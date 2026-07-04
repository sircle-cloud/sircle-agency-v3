import { describe, it, expect } from 'vitest';
import { BookingService } from '@/core/booking';
import { MemoryRepository } from '@/adapters/repo/memory';
import { MockCalendar } from '@/adapters/calendar/mock';
import { ConsoleMailer } from '@/adapters/mail/console';
import { SlotUnavailableError } from '@/core/errors';

let counter = 0;
function buildService() {
  const repo = new MemoryRepository();
  const service = new BookingService(
    repo,
    new MockCalendar(),
    new ConsoleMailer(),
    () => `bk_${++counter}`,
  );
  return { repo, service };
}

const WINDOW = {
  tenantSlug: 'sircle',
  eventTypeSlug: 'intake',
  fromUtc: '2026-07-06T00:00:00.000Z',
  toUtc: '2026-07-07T00:00:00.000Z',
  nowUtc: '2026-07-01T00:00:00.000Z',
};

describe('BookingService', () => {
  it('boekt een beschikbaar slot en maakt het daarna onbeschikbaar', async () => {
    const { service } = buildService();
    const { slots } = await service.listAvailableSlots(WINDOW);
    expect(slots.length).toBeGreaterThan(0);
    const start = slots[0].startUtc;

    const booking = await service.createBooking({
      tenantSlug: 'sircle',
      eventTypeSlug: 'intake',
      guestName: 'Test Gast',
      guestEmail: 'gast@example.com',
      guestTimezone: 'Europe/Amsterdam',
      startUtc: start,
      nowUtc: WINDOW.nowUtc,
    });
    expect(booking.status).toBe('confirmed');

    const after = await service.listAvailableSlots(WINDOW);
    expect(after.slots.map((s) => s.startUtc)).not.toContain(start);
  });

  it('weigert een tweede boeking op hetzelfde slot (dubbel-boek-preventie)', async () => {
    const { service } = buildService();
    const { slots } = await service.listAvailableSlots(WINDOW);
    const start = slots[0].startUtc;

    await service.createBooking({
      tenantSlug: 'sircle',
      eventTypeSlug: 'intake',
      guestName: 'Eerste',
      guestEmail: 'een@example.com',
      guestTimezone: 'Europe/Amsterdam',
      startUtc: start,
      nowUtc: WINDOW.nowUtc,
    });

    await expect(
      service.createBooking({
        tenantSlug: 'sircle',
        eventTypeSlug: 'intake',
        guestName: 'Tweede',
        guestEmail: 'twee@example.com',
        guestTimezone: 'Europe/Amsterdam',
        startUtc: start,
        nowUtc: WINDOW.nowUtc,
      }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it('is idempotent: dezelfde idempotencyKey levert dezelfde boeking op', async () => {
    const { repo, service } = buildService();
    const { slots } = await service.listAvailableSlots(WINDOW);
    const start = slots[1].startUtc;
    const input = {
      tenantSlug: 'sircle',
      eventTypeSlug: 'intake',
      guestName: 'Herhaald',
      guestEmail: 'herhaald@example.com',
      guestTimezone: 'Europe/Amsterdam',
      startUtc: start,
      idempotencyKey: 'key-123',
      nowUtc: WINDOW.nowUtc,
    };
    const first = await service.createBooking(input);
    const second = await service.createBooking(input);
    expect(second.id).toBe(first.id);

    const all = await (repo as unknown as { _allBookings(): Promise<unknown[]> })._allBookings();
    expect(all.length).toBe(1);
  });

  it('valideert verplichte velden', async () => {
    const { service } = buildService();
    const { slots } = await service.listAvailableSlots(WINDOW);
    await expect(
      service.createBooking({
        tenantSlug: 'sircle',
        eventTypeSlug: 'intake',
        guestName: '',
        guestEmail: 'geen-email',
        guestTimezone: 'Europe/Amsterdam',
        startUtc: slots[0].startUtc,
        nowUtc: WINDOW.nowUtc,
      }),
    ).rejects.toThrow();
  });
});
