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
import { effectiveHostIds } from './types';
import { computeSlots, isSlotAvailable } from './availability';
import { NotFoundError, SlotUnavailableError, ValidationError } from './errors';
import { addMinutesIso, formatInZone, nowUtcIso } from './time';
import { buildIcs } from '../adapters/ics';
import { signBookingToken } from '../auth/booking-token';

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
    const { tenant, eventType, hosts } = await this.resolve(
      params.tenantSlug,
      params.eventTypeSlug,
    );
    const now = params.nowUtc ?? nowUtcIso();

    // Per host de vrije slots; bij round-robin is de UNIE beschikbaar (een slot
    // wordt aangeboden zodra minstens één host vrij is).
    const perHost = await Promise.all(
      hosts.map(async (h) => {
        const slots = await this.hostSlots(tenant.id, h, eventType, params.fromUtc, params.toUtc, now);
        return slots;
      }),
    );

    const seen = new Set<string>();
    const slots = perHost
      .flat()
      .filter((s) => (seen.has(s.startUtc) ? false : (seen.add(s.startUtc), true)))
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc));

    return { tenant, eventType, slots };
  }

  private async hostSlots(
    tenantId: string,
    host: HostCtx,
    eventType: EventType,
    fromUtc: string,
    toUtc: string,
    nowUtc: string,
  ): Promise<Slot[]> {
    const [rules, blocked, bookings] = await Promise.all([
      this.repo.getRules(tenantId, host.user.id),
      this.repo.getBlockedDates(tenantId, host.user.id),
      this.repo.listBookings({ tenantId, hostUserId: host.user.id, fromUtc, toUtc }),
    ]);
    const busy = host.connectionRef
      ? await this.calendar.getBusy({ connectionRef: host.connectionRef, fromUtc, toUtc })
      : [];
    return computeSlots({ eventType, rules, blocked, busy, bookings, fromUtc, toUtc, nowUtc });
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const { tenant, eventType, hosts } = await this.resolve(
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

    // 3. Bepaal welke hosts op dit slot vrij zijn (free/busy op het laatste moment).
    const chosen = await this.pickHost(tenant.id, hosts, eventType, startUtc, now);
    if (!chosen) throw new SlotUnavailableError();

    // 4. Atomaire persist met overlap-guard, toegewezen aan de gekozen host.
    const booking: Booking = {
      id: this.idGen(),
      tenantId: tenant.id,
      eventTypeId: eventType.id,
      hostUserId: chosen.user.id,
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

    // 5. Twee-weg sync outbound: event in de agenda van de gekozen host.
    if (chosen.connectionRef) {
      try {
        const { externalEventId } = await this.calendar.createEvent({
          connectionRef: chosen.connectionRef,
          booking: saved,
          eventType,
          host: chosen.user,
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
    await this.sendConfirmation(saved, tenant, eventType, chosen.user);

    return saved;
  }

  /**
   * Kies een host die op het slot vrij is. Bij round-robin (meerdere hosts):
   * de vrije host met de minste aankomende boekingen — eerlijke verdeling.
   */
  private async pickHost(
    tenantId: string,
    hosts: HostCtx[],
    eventType: EventType,
    startUtc: string,
    nowUtc: string,
  ): Promise<HostCtx | null> {
    const endUtc = addMinutesIso(startUtc, eventType.durationMin);
    const free: Array<{ host: HostCtx; load: number }> = [];

    for (const host of hosts) {
      const [rules, blocked, bookings] = await Promise.all([
        this.repo.getRules(tenantId, host.user.id),
        this.repo.getBlockedDates(tenantId, host.user.id),
        this.repo.listBookings({ tenantId, hostUserId: host.user.id, fromUtc: startUtc, toUtc: endUtc }),
      ]);
      const busy = host.connectionRef
        ? await this.calendar.getBusy({ connectionRef: host.connectionRef, fromUtc: startUtc, toUtc: endUtc })
        : [];
      const available = isSlotAvailable({ eventType, rules, blocked, busy, bookings, nowUtc, startUtc });
      if (!available) continue;

      // Load = aantal aankomende bevestigde boekingen (voor round-robin fairness).
      const upcoming = await this.repo.listBookings({
        tenantId,
        hostUserId: host.user.id,
        fromUtc: nowUtc,
        toUtc: addMinutesIso(nowUtc, 60 * 24 * 60), // ~60 dagen
      });
      free.push({ host, load: upcoming.filter((b) => b.status === 'confirmed').length });
    }

    if (free.length === 0) return null;
    free.sort((a, b) => a.load - b.load);
    return free[0].host;
  }

  private async sendConfirmation(
    booking: Booking,
    tenant: Tenant,
    eventType: EventType,
    host: User,
  ): Promise<void> {
    const whenGuest = formatInZone(booking.startUtc, booking.guestTimezone);
    const ics = buildIcs({ booking, eventType, tenant, host });
    // Beveiligde self-service-link om te verzetten/annuleren (zonder account).
    const base = process.env.APP_URL ?? '';
    const manageUrl = `${base}/manage/${booking.id}?token=${signBookingToken(booking.id)}`;

    await this.mailer.send({
      to: booking.guestEmail,
      subject: `Bevestiging: ${eventType.name} — ${tenant.name}`,
      text:
        `Hoi ${booking.guestName},\n\n` +
        `Je afspraak is bevestigd.\n\n` +
        `Wat: ${eventType.name}\n` +
        `Wanneer: ${whenGuest} (${booking.guestTimezone})\n` +
        `Duur: ${eventType.durationMin} minuten\n\n` +
        `Verzetten of annuleren? ${manageUrl}\n\n` +
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
  ): Promise<{ tenant: Tenant; eventType: EventType; hosts: HostCtx[] }> {
    const tenant = await this.repo.getTenantBySlug(tenantSlug);
    if (!tenant) throw new NotFoundError('Onbekende organisatie.');
    const eventType = await this.repo.getEventType(tenant.id, eventTypeSlug);
    if (!eventType) throw new NotFoundError('Onbekend afspraaktype.');

    const hosts: HostCtx[] = [];
    for (const userId of effectiveHostIds(eventType)) {
      const user = await this.repo.getUser(tenant.id, userId);
      if (!user) continue;
      const connectionRef = await this.repo.getCalendarConnectionRef(tenant.id, user.id);
      hosts.push({ user, connectionRef });
    }
    if (hosts.length === 0) throw new NotFoundError('Onbekende host.');
    return { tenant, eventType, hosts };
  }
}

interface HostCtx {
  user: User;
  connectionRef: string | null;
}
