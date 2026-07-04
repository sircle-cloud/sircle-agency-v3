import { describe, it, expect } from 'vitest';
import { ReminderService } from '@/core/reminders';
import { MemoryRepository } from '@/adapters/repo/memory';
import { ConsoleMailer } from '@/adapters/mail/console';
import { buildSeed } from '@/adapters/seed';
import type { Booking } from '@/core/types';

const NOW = '2026-07-06T08:00:00.000Z';

function booking(id: string, startUtc: string): Booking {
  return {
    id,
    tenantId: 't_sircle',
    eventTypeId: 'et_intake',
    hostUserId: 'u_koen',
    guestName: 'Gast ' + id,
    guestEmail: `${id}@example.com`,
    guestTimezone: 'Europe/Amsterdam',
    startUtc,
    endUtc: new Date(new Date(startUtc).getTime() + 30 * 60_000).toISOString(),
    status: 'confirmed',
    createdAt: NOW,
  };
}

function build() {
  const seed = buildSeed();
  seed.bookings.push(
    booking('soon', '2026-07-06T10:00:00.000Z'), // over 2 uur → binnen 24u
    booking('later', '2026-07-10T10:00:00.000Z'), // over dagen → buiten 24u
  );
  const repo = new MemoryRepository(seed);
  const mailer = new ConsoleMailer();
  return { repo, mailer, service: new ReminderService(repo, mailer) };
}

describe('ReminderService', () => {
  it('mailt alleen afspraken binnen 24 uur', async () => {
    const { service, mailer } = build();
    const res = await service.sendDueReminders({ nowUtc: NOW });
    expect(res.sent).toBe(1);
    expect(res.bookingIds).toEqual(['soon']);
    expect(mailer.sent.length).toBe(1);
    expect(mailer.sent[0].subject).toContain('Herinnering');
  });

  it('is idempotent: een tweede run mailt niet opnieuw', async () => {
    const { service, mailer } = build();
    await service.sendDueReminders({ nowUtc: NOW });
    const second = await service.sendDueReminders({ nowUtc: NOW });
    expect(second.sent).toBe(0);
    expect(mailer.sent.length).toBe(1);
  });

  it('respecteert een aangepaste leadMinutes', async () => {
    const { service } = build();
    // Met 6 dagen lead vallen beide boekingen binnen het venster.
    const res = await service.sendDueReminders({ nowUtc: NOW, leadMinutes: 6 * 24 * 60 });
    expect(res.sent).toBe(2);
  });
});
