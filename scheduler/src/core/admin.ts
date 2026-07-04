/**
 * AdminService — beheeracties voor een ingelogde tenant: afspraaktypes,
 * beschikbaarheid, boekingen inzien en annuleren. Praat alleen met de ports.
 */
import type { BookingRepository, CalendarProvider } from '../ports/index';
import type { AvailabilityRule, Booking, EventType, User } from './types';
import { NotFoundError, ValidationError } from './errors';

/** Eén regel in de wekelijkse beschikbaarheids-editor (lokale wandkloktijd). */
export interface WeeklySlotInput {
  weekday: number; // 1..7
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

function hhmmToMinutes(v: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) throw new ValidationError(`Ongeldige tijd: ${v}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new ValidationError(`Ongeldige tijd: ${v}`);
  return h * 60 + min;
}

export class AdminService {
  constructor(
    private repo: BookingRepository,
    private calendar: CalendarProvider,
    private idGen: () => string,
  ) {}

  listEventTypes(tenantId: string): Promise<EventType[]> {
    return this.repo.listEventTypes(tenantId);
  }

  async saveEventType(input: {
    id?: string;
    tenantId: string;
    hostUserId: string;
    hostUserIds?: string[];
    slug: string;
    name: string;
    description?: string;
    durationMin: number;
    slotGranularityMin?: number;
    bufferBeforeMin: number;
    bufferAfterMin: number;
    minNoticeMin: number;
    locationType: EventType['locationType'];
  }): Promise<EventType> {
    if (!input.name?.trim()) throw new ValidationError('Naam is verplicht.');
    if (!/^[a-z0-9-]+$/.test(input.slug)) {
      throw new ValidationError('Slug mag alleen kleine letters, cijfers en koppeltekens bevatten.');
    }
    if (input.durationMin <= 0) throw new ValidationError('Duur moet groter dan 0 zijn.');

    // Round-robin pool: valideer dat alle host-ids bij deze tenant horen.
    const pool = (input.hostUserIds ?? []).filter(Boolean);
    for (const uid of pool) {
      if (!(await this.repo.getUser(input.tenantId, uid))) {
        throw new ValidationError('Onbekende host in de round-robin pool.');
      }
    }

    const eventType: EventType = {
      id: input.id ?? this.idGen(),
      tenantId: input.tenantId,
      hostUserId: input.hostUserId,
      hostUserIds: pool.length > 0 ? pool : undefined,
      slug: input.slug,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      durationMin: input.durationMin,
      slotGranularityMin: input.slotGranularityMin,
      bufferBeforeMin: input.bufferBeforeMin,
      bufferAfterMin: input.bufferAfterMin,
      minNoticeMin: input.minNoticeMin,
      locationType: input.locationType,
    };
    return this.repo.saveEventType(eventType);
  }

  listTeam(tenantId: string): Promise<User[]> {
    return this.repo.listUsers(tenantId);
  }

  /** Voeg een teamlid (extra host) toe met directe default-beschikbaarheid. */
  async addTeamMember(input: {
    tenantId: string;
    name: string;
    email: string;
    passwordHash: string;
    timezone?: string;
  }): Promise<User> {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name) throw new ValidationError('Naam is verplicht.');
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new ValidationError('Geldig e-mailadres is verplicht.');
    }
    if (await this.repo.getUserByEmail(email)) {
      throw new ValidationError('Er bestaat al een account met dit e-mailadres.');
    }
    const timezone = input.timezone?.trim() || 'Europe/Amsterdam';
    const user: User = {
      id: this.idGen(),
      tenantId: input.tenantId,
      email,
      name,
      passwordHash: input.passwordHash,
    };
    await this.repo.createUser(user);
    await this.repo.replaceAvailability(
      input.tenantId,
      user.id,
      [1, 2, 3, 4, 5].map((weekday) => ({
        id: this.idGen(),
        tenantId: input.tenantId,
        userId: user.id,
        weekday,
        startMinutes: 9 * 60,
        endMinutes: 17 * 60,
        timezone,
      })),
    );
    return user;
  }

  deleteEventType(tenantId: string, id: string): Promise<void> {
    return this.repo.deleteEventType(tenantId, id);
  }

  getAvailability(tenantId: string, userId: string): Promise<AvailabilityRule[]> {
    return this.repo.getRules(tenantId, userId);
  }

  async saveAvailability(
    tenantId: string,
    userId: string,
    timezone: string,
    slots: WeeklySlotInput[],
  ): Promise<void> {
    const rules: AvailabilityRule[] = slots.map((s) => {
      const startMinutes = hhmmToMinutes(s.start);
      const endMinutes = hhmmToMinutes(s.end);
      if (endMinutes <= startMinutes) {
        throw new ValidationError('Eindtijd moet na de starttijd liggen.');
      }
      return {
        id: this.idGen(),
        tenantId,
        userId,
        weekday: s.weekday,
        startMinutes,
        endMinutes,
        timezone,
      };
    });
    await this.repo.replaceAvailability(tenantId, userId, rules);
  }

  listBookings(tenantId: string, fromUtc: string): Promise<Booking[]> {
    return this.repo.listTenantBookings(tenantId, fromUtc);
  }

  /** Annuleer een boeking en verwijder het gekoppelde agenda-event (twee-weg sync). */
  async cancelBooking(tenantId: string, bookingId: string): Promise<Booking> {
    const booking = await this.repo.getBooking(tenantId, bookingId);
    if (!booking) throw new NotFoundError('Boeking niet gevonden.');
    if (booking.status === 'cancelled') return booking;

    booking.status = 'cancelled';
    const updated = await this.repo.updateBooking(booking);

    if (booking.externalEventId) {
      const conn = await this.repo.getCalendarConnection(tenantId, booking.hostUserId);
      if (conn) {
        try {
          await this.calendar.deleteEvent({
            connectionRef: conn.connectionRef,
            externalEventId: booking.externalEventId,
          });
        } catch (err) {
          console.error('[admin] agenda-event verwijderen mislukt (later herstellen):', err);
        }
      }
    }
    return updated;
  }
}
