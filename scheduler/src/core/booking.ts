/**
 * BookingService — orkestreert het aanmaken van een boeking:
 *  1. idempotentie (dubbele submit → zelfde boeking terug)
 *  2. validatie
 *  3. free/busy op het laatste moment (§4) — race-preventie stap 1
 *  4. atomaire persist met overlap-guard (§7) — race-preventie stap 2
 *  5. event naar de agenda pushen (twee-weg sync, outbound)
 *  6. bevestigingsmail + .ics
 *
 * Puur georkestreerd via ports; geen directe afhankelijkheid van Nylas/Prisma.
 */
import type { BookingRepository, CalendarProvider, Mailer } from '../ports/index';
import type { Booking, EventType, Slot, Tenant, User } from './types';
import { isSlotAvailable } from './availability';
import { NotFoundError, SlotUnavailableError, ValidationError } from './errors';
import { addMinutesIso, formatInZone, nowUtcIso } from './time';
import { buildIcs } from '../adapters/ics';

export interface CreateBookingInput {
  tenantSlug: string;
  eventTypeSlug: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  startUtc: string;
  idempotencyKey?: string;
  nowUtc?: string; // injecteerbaar voor tests
}

export class BookingService {
  constructor(
    private repo: BookingRepository,
    private calendar: CalendarProvider,
    private mailer: Mailer,
    private idGen: () => string,
  ) {}

  async listAvailableSlots(params: {
    tenantSlug: string;
    eventTypeSlug: string;
    fromUtc: string;
    toUtc: string;
    nowUtc?: string;
  }): Promise<{ tenant: Tenant; eventType: EventType; slots: Slot[] }> {
    const { tenant, eventType, host, connectionRef } = await this.resolve(
      params.tenantSlug,
      params.eventTypeSlug,
    );

    const [rules, blocked, bookings] = await Promise.all([
      this.repo.getRules(tenant.id, host.id),
      this.repo.getBlockedDates(tenant.id, host.id),
      this.repo.listBookings({
        tenantId: tenant.id,
        hostUserId: host.id,
        fromUtc: params.fromUtc,
        toUtc: params.toUtc,
      }),
    ]);

    const busy = connectionRef
      ? await this.calendar.getBusy({
          connectionRef,
          fromUtc: params.fromUtc,
          toUtc: params.toUtc,
        })
      : [];

    const { computeSlots } = await import('./availability');
    const slots = computeSlots({
      eventType,
      rules,
      blocked,
      busy,
      bookings,
      fromUtc: params.fromUtc,
      toUtc: params.toUtc,
      nowUtc: params.nowUtc ?? nowUtcIso(),
    });

    return { tenant, eventType, slots };
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const { tenant, eventType, host, connectionRef } = await this.resolve(
      input.tenantSlug,
      input.eventTypeSlug,
    );

    // 1. Idempotentie: zelfde key → geef de bestaande boeking terug.
    if (input.idempotencyKey) {
      const existing = await this.repo.findByIdempotencyKey(tenant.id, input.idempotencyKey);
      if (existing) return existing;
    }

    // 2. Validatie.
    this.validate(input);

    const now = input.nowUtc ?? nowUtcIso();
    const startUtc = input.startUtc;
    const endUtc = addMinutesIso(startUtc, eventType.durationMin);

    // 3. Free/busy op het laatste moment.
    const [rules, blocked, bookings] = await Promise.all([
      this.repo.getRules(tenant.id, host.id),
      this.repo.getBlockedDates(tenant.id, host.id),
      this.repo.listBookings({
        tenantId: tenant.id,
        hostUserId: host.id,
        fromUtc: startUtc,
        toUtc: endUtc,
      }),
    ]);
    const busy = connectionRef
      ? await this.calendar.getBusy({ connectionRef, fromUtc: startUtc, toUtc: endUtc })
      : [];

    const available = isSlotAvailable({
      eventType,
      rules,
      blocked,
      busy,
      bookings,
      nowUtc: now,
      startUtc,
    });
    if (!available) throw new SlotUnavailableError();

    // 4. Atomaire persist met overlap-guard.
    const booking: Booking = {
      id: this.idGen(),
      tenantId: tenant.id,
      eventTypeId: eventType.id,
      hostUserId: host.id,
      guestName: input.guestName.trim(),
      guestEmail: input.guestEmail.trim().toLowerCase(),
      guestTimezone: input.guestTimezone,
      startUtc,
      endUtc,
      status: 'confirmed',
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
    };
    const saved = await this.repo.createBookingAtomically(booking);

    // 5. Twee-weg sync outbound: event in de agenda van de host.
    if (connectionRef) {
      try {
        const { externalEventId } = await this.calendar.createEvent({
          connectionRef,
          booking: saved,
          eventType,
          host,
          syncTag: `sircle:${tenant.id}:${saved.id}`,
        });
        saved.externalEventId = externalEventId;
        await this.repo.updateBooking(saved);
      } catch (err) {
        // De boeking staat vast; agenda-push kan later opnieuw (reconciliatie).
        // In prod: log + queue voor retry. Hier bewust niet fataal.
        console.error('[booking] agenda-push mislukt, wordt later hersteld:', err);
      }
    }

    // 6. Bevestigingsmail + .ics.
    await this.sendConfirmation(saved, tenant, eventType, host);

    return saved;
  }

  private async sendConfirmation(
    booking: Booking,
    tenant: Tenant,
    eventType: EventType,
    host: User,
  ): Promise<void> {
    const whenGuest = formatInZone(booking.startUtc, booking.guestTimezone);
    const ics = buildIcs({ booking, eventType, tenant, host });

    await this.mailer.send({
      to: booking.guestEmail,
      subject: `Bevestiging: ${eventType.name} — ${tenant.name}`,
      text:
        `Hoi ${booking.guestName},\n\n` +
        `Je afspraak is bevestigd.\n\n` +
        `Wat: ${eventType.name}\n` +
        `Wanneer: ${whenGuest} (${booking.guestTimezone})\n` +
        `Duur: ${eventType.durationMin} minuten\n\n` +
        `Tot dan!\n${tenant.name}`,
      icsAttachment: { filename: 'afspraak.ics', content: ics },
    });
  }

  private validate(input: CreateBookingInput): void {
    if (!input.guestName?.trim()) throw new ValidationError('Naam is verplicht.');
    if (!input.guestEmail?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.guestEmail)) {
      throw new ValidationError('Geldig e-mailadres is verplicht.');
    }
    if (!input.guestTimezone) throw new ValidationError('Tijdzone is verplicht.');
    if (!input.startUtc) throw new ValidationError('Starttijd is verplicht.');
  }

  private async resolve(
    tenantSlug: string,
    eventTypeSlug: string,
  ): Promise<{ tenant: Tenant; eventType: EventType; host: User; connectionRef: string | null }> {
    const tenant = await this.repo.getTenantBySlug(tenantSlug);
    if (!tenant) throw new NotFoundError('Onbekende organisatie.');
    const eventType = await this.repo.getEventType(tenant.id, eventTypeSlug);
    if (!eventType) throw new NotFoundError('Onbekend afspraaktype.');
    const host = await this.repo.getUser(tenant.id, eventType.hostUserId);
    if (!host) throw new NotFoundError('Onbekende host.');
    const connectionRef = await this.repo.getCalendarConnectionRef(tenant.id, host.id);
    return { tenant, eventType, host, connectionRef };
  }
}
