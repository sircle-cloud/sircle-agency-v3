/**
 * ReminderService — stuurt herinneringsmails vóór een afspraak. No-show-reductie
 * is een van de sterkste verkoopargumenten (§5 van het plan). Idempotent via
 * `reminderSentAt`, zodat een herhaalde cron-run niet dubbel mailt.
 */
import type { BookingRepository, Mailer } from '../ports/index';
import { formatInZone } from './time';

export interface SendRemindersResult {
  sent: number;
  bookingIds: string[];
}

export class ReminderService {
  constructor(
    private repo: BookingRepository,
    private mailer: Mailer,
  ) {}

  /**
   * Verstuur herinneringen voor bevestigde boekingen die binnen `leadMinutes`
   * (default 24 uur) starten en nog geen herinnering hebben gehad.
   */
  async sendDueReminders(params: {
    nowUtc: string;
    leadMinutes?: number;
  }): Promise<SendRemindersResult> {
    const lead = params.leadMinutes ?? 24 * 60;
    const untilUtc = new Date(new Date(params.nowUtc).getTime() + lead * 60_000).toISOString();

    const due = await this.repo.listBookingsForReminders(params.nowUtc, untilUtc);
    const bookingIds: string[] = [];

    for (const booking of due) {
      const tenant = await this.repo.getTenantById(booking.tenantId);
      const when = formatInZone(booking.startUtc, booking.guestTimezone);
      await this.mailer.send({
        to: booking.guestEmail,
        subject: `Herinnering: je afspraak${tenant ? ` bij ${tenant.name}` : ''}`,
        text:
          `Hoi ${booking.guestName},\n\n` +
          `Een korte herinnering aan je afspraak:\n\n` +
          `Wanneer: ${when} (${booking.guestTimezone})\n\n` +
          `Tot snel!${tenant ? `\n${tenant.name}` : ''}`,
      });
      await this.repo.markReminderSent(booking.id, params.nowUtc);
      bookingIds.push(booking.id);
    }

    return { sent: bookingIds.length, bookingIds };
  }
}
