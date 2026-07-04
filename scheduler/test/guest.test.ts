import { describe, it, expect } from 'vitest';
import { GuestBookingService } from '@/core/guest';
import { BookingService } from '@/core/booking';
import { MemoryRepository } from '@/adapters/repo/memory';
import { MockCalendar } from '@/adapters/calendar/mock';
import { ConsoleMailer } from '@/adapters/mail/console';
import { signBookingToken } from '@/auth/booking-token';
import { NotFoundError, SlotUnavailableError } from '@/core/errors';

let n = 0;
const id = () => `g_${++n}`;
const NOW = '2026-07-01T00:00:00.000Z';
const WINDOW = {
  tenantSlug: 'sircle',
  eventTypeSlug: 'intake',
  fromUtc: '2026-07-06T00:00:00.000Z',
  toUtc: '2026-07-07T00:00:00.000Z',
  nowUtc: NOW,
};

function build() {
  const repo = new MemoryRepository();
  const calendar = new MockCalendar();
  const booking = new BookingService(repo, calendar, new ConsoleMailer(), id);
  const guest = new GuestBookingService(repo, calendar, new ConsoleMailer());
  return { repo, booking, guest };
}

async function makeBooking(booking: BookingService, startUtc: string) {
  return booking.createBooking({
    tenantSlug: 'sircle',
    eventTypeSlug: 'intake',
    guestName: 'Gast',
    guestEmail: 'gast@example.com',
    guestTimezone: 'Europe/Amsterdam',
    startUtc,
    nowUtc: NOW,
  });
}

describe('GuestBookingService', () => {
  it('weigert toegang met een ongeldig token', async () => {
    const { booking, guest } = build();
    const made = await makeBooking(booking, '2026-07-06T07:00:00.000Z');
    await expect(guest.getManageable(made.id, 'fout-token')).rejects.toBeInstanceOf(NotFoundError);
    // Met geldig token lukt het wel.
    const ok = await guest.getManageable(made.id, signBookingToken(made.id));
    expect(ok.booking.id).toBe(made.id);
  });

  it('annuleert met een geldig token en maakt het slot weer vrij', async () => {
    const { booking, guest } = build();
    const start = '2026-07-06T07:00:00.000Z';
    const made = await makeBooking(booking, start);
    await guest.cancel(made.id, signBookingToken(made.id));

    const after = await booking.listAvailableSlots(WINDOW);
    expect(after.slots.map((s) => s.startUtc)).toContain(start);
  });

  it('verzet een afspraak naar een beschikbaar slot', async () => {
    const { booking, guest } = build();
    const made = await makeBooking(booking, '2026-07-06T07:00:00.000Z');
    // Verzet naar 12:00 lokaal (10:00Z) — ver genoeg dat de buffer 07:00 niet raakt.
    const moved = await guest.reschedule(
      made.id,
      signBookingToken(made.id),
      '2026-07-06T10:00:00.000Z',
      NOW,
    );
    expect(moved.startUtc).toBe('2026-07-06T10:00:00.000Z');

    // Het oude slot is weer vrij, het nieuwe niet meer.
    const after = await booking.listAvailableSlots(WINDOW);
    const starts = after.slots.map((s) => s.startUtc);
    expect(starts).toContain('2026-07-06T07:00:00.000Z');
    expect(starts).not.toContain('2026-07-06T10:00:00.000Z');
  });

  it('weigert verzetten naar een tijd buiten de beschikbaarheid', async () => {
    const { booking, guest } = build();
    const made = await makeBooking(booking, '2026-07-06T07:00:00.000Z');
    await expect(
      guest.reschedule(made.id, signBookingToken(made.id), '2026-07-06T02:00:00.000Z', NOW),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });
});
