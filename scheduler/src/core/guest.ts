/**
 * GuestBookingService — self-service voor gasten via een beveiligde link
 * (HMAC-token, geen account). Sluit de boekingslevenscyclus: bekijken,
 * annuleren en verzetten, telkens met twee-weg agenda-sync.
 */
import type { BookingRepository, CalendarProvider, Mailer } from '../ports/index';
import type { Booking, EventType, Tenant } from './types';
import { isSlotAvailable } from './availability';
import { NotFoundError, SlotUnavailableError, ValidationError } from './errors';
import { verifyBookingToken } from '../auth/booking-token';
import { addMinutesIso, formatInZone, nowUtcIso } from './time';

export interface ManageableBooking {
  booking: Booking;
  tenant: Tenant;
  eventType: EventType;
}

export class GuestBookingService {
  constructor(
    private repo: BookingRepository,
    private calendar: CalendarProvider,
    private mailer: Mailer,
  ) {}

  /** Haal een boeking op na tokencontrole (voor de beheerpagina). */
  async getManageable(bookingId: string, token: string | undefined): Promise<ManageableBooking> {
    if (!verifyBookingToken(bookingId, token)) throw new NotFoundError('Ongeldige of verlopen link.');
    const booking = await this.repo.findBookingById(bookingId);
    if (!booking) throw new NotFoundError('Boeking niet gevonden.');
    const [tenant, eventType] = await Promise.all([
      this.repo.getTenantById(booking.tenantId),
      this.repo.getEventTypeById(booking.tenantId, booking.eventTypeId),
    ]);
    if (!tenant || !eventType) throw new NotFoundError('Boeking niet gevonden.');
    return { booking, tenant, eventType };
  }

  async cancel(bookingId: string, token: string | undefined): Promise<Booking> {
    const { booking, tenant, eventType } = await this.getManageable(bookingId, token);
    if (booking.status === 'cancelled') return booking;

    booking.status = 'cancelled';
    const updated = await this.repo.updateBooking(booking);
    await this.removeCalendarEvent(booking);

    await this.mailer.send({
      to: booking.guestEmail,
      subject: `Geannuleerd: ${eventType.name} — ${tenant.name}`,
      text:
        `Hoi ${booking.guestName},\n\n` +
        `Je afspraak is geannuleerd.\n\n` +
        `Was gepland: ${formatInZone(booking.startUtc, booking.guestTimezone)} (${booking.guestTimezone})\n\n` +
        `${tenant.name}`,
    });
    return updated;
  }

  async reschedule(
    bookingId: string,
    token: string | undefined,
    newStartUtc: string,
    nowUtc = nowUtcIso(),
  ): Promise<Booking> {
    const { booking, tenant, eventType } = await this.getManageable(bookingId, token);
    if (booking.status === 'cancelled') {
      throw new ValidationError('Een geannuleerde afspraak kan niet verzet worden.');
    }
    if (!newStartUtc) throw new ValidationError('Nieuwe starttijd is verplicht.');

    const newEndUtc = addMinutesIso(newStartUtc, eventType.durationMin);

    // Controleer beschikbaarheid van het nieuwe slot, exclusief déze boeking.
    const [rules, blocked, bookings] = await Promise.all([
      this.repo.getRules(tenant.id, booking.hostUserId),
      this.repo.getBlockedDates(tenant.id, booking.hostUserId),
      this.repo.listBookings({
        tenantId: tenant.id,
        hostUserId: booking.hostUserId,
        fromUtc: newStartUtc,
        toUtc: newEndUtc,
      }),
    ]);
    const conn = await this.repo.getCalendarConnection(tenant.id, booking.hostUserId);
    const busy = conn?.status === 'active'
      ? await this.calendar.getBusy({ connectionRef: conn.connectionRef, fromUtc: newStartUtc, toUtc: newEndUtc })
      : [];

    const available = isSlotAvailable({
      eventType,
      rules,
      blocked,
      busy: busy.filter((b) => !(b.startUtc === booking.startUtc && b.endUtc === booking.endUtc)),
      bookings: bookings.filter((b) => b.id !== booking.id),
      nowUtc,
      startUtc: newStartUtc,
    });
    if (!available) throw new SlotUnavailableError();

    const oldExternalEventId = booking.externalEventId;
    booking.startUtc = newStartUtc;
    booking.endUtc = newEndUtc;
    booking.externalEventId = undefined;
    const updated = await this.repo.rescheduleBookingAtomically(booking);

    // Twee-weg sync: oud event weg, nieuw event erin.
    if (conn?.status === 'active') {
      try {
        if (oldExternalEventId) {
          await this.calendar.deleteEvent({ connectionRef: conn.connectionRef, externalEventId: oldExternalEventId });
        }
        const host = await this.repo.getUser(tenant.id, booking.hostUserId);
        if (host) {
          const { externalEventId } = await this.calendar.createEvent({
            connectionRef: conn.connectionRef,
            booking: updated,
            eventType,
            host,
            syncTag: `sircle:${tenant.id}:${updated.id}`,
          });
          updated.externalEventId = externalEventId;
          await this.repo.updateBooking(updated);
        }
      } catch (err) {
        console.error('[guest] agenda-verzetten mislukt (reconciliatie herstelt later):', err);
      }
    }

    await this.mailer.send({
      to: booking.guestEmail,
      subject: `Verzet: ${eventType.name} — ${tenant.name}`,
      text:
        `Hoi ${booking.guestName},\n\n` +
        `Je afspraak is verzet naar:\n` +
        `${formatInZone(newStartUtc, booking.guestTimezone)} (${booking.guestTimezone})\n\n` +
        `Tot dan!\n${tenant.name}`,
    });
    return updated;
  }

  private async removeCalendarEvent(booking: Booking): Promise<void> {
    if (!booking.externalEventId) return;
    const conn = await this.repo.getCalendarConnection(booking.tenantId, booking.hostUserId);
    if (!conn) return;
    try {
      await this.calendar.deleteEvent({
        connectionRef: conn.connectionRef,
        externalEventId: booking.externalEventId,
      });
    } catch (err) {
      console.error('[guest] agenda-event verwijderen mislukt:', err);
    }
  }
}
