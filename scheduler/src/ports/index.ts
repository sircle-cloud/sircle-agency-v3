/**
 * Ports = de interfaces waar de domeinlaag tegenaan praat. Adapters (Nylas,
 * Prisma, Resend, én mocks) implementeren ze. Dit is de kern van de
 * anti-lock-in-strategie uit §6: van sync-provider of database wisselen is een
 * adapter-swap, geen herbouw.
 */
import type {
  Booking,
  BusyInterval,
  EventType,
  Tenant,
  User,
  AvailabilityRule,
  BlockedDate,
} from '../core/types';

/** Twee-weg agenda-sync. Geïmplementeerd door NylasCalendar (prod) en MockCalendar (dev). */
export interface CalendarProvider {
  /** Lees bezet-tijd (free/busy) van een host tussen from/to. Geen event-details (privacy). */
  getBusy(params: {
    connectionRef: string; // bv. Nylas grant-id
    fromUtc: string;
    toUtc: string;
  }): Promise<BusyInterval[]>;

  /** Schrijf een bevestigde boeking als event in de agenda van de host. Geeft extern event-id terug. */
  createEvent(params: {
    connectionRef: string;
    booking: Booking;
    eventType: EventType;
    host: User;
    /** Verborgen metadata-tag tegen sync-echo-loops (§4). */
    syncTag: string;
  }): Promise<{ externalEventId: string }>;

  /** Verwijder een eerder aangemaakt event (bij annuleren). */
  deleteEvent(params: { connectionRef: string; externalEventId: string }): Promise<void>;
}

export interface Mailer {
  send(params: {
    to: string;
    subject: string;
    text: string;
    icsAttachment?: { filename: string; content: string };
  }): Promise<void>;
}

/**
 * Persistentie. De MemoryRepository (dev/tests) en PrismaRepository (prod)
 * implementeren dit. `createBookingAtomically` MOET dubbel-boeken atomair
 * afwijzen (in prod via Postgres exclusion-constraint, §7).
 */
export interface BookingRepository {
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  getEventType(tenantId: string, slug: string): Promise<EventType | null>;
  getUser(tenantId: string, userId: string): Promise<User | null>;
  getRules(tenantId: string, userId: string): Promise<AvailabilityRule[]>;
  getBlockedDates(tenantId: string, userId: string): Promise<BlockedDate[]>;
  getCalendarConnectionRef(tenantId: string, userId: string): Promise<string | null>;

  listBookings(params: {
    tenantId: string;
    hostUserId: string;
    fromUtc: string;
    toUtc: string;
  }): Promise<Booking[]>;

  findByIdempotencyKey(tenantId: string, key: string): Promise<Booking | null>;

  /**
   * Sla een boeking op en wijs af als het slot inmiddels bezet is. Deze methode
   * is het atomaire hart van de dubbel-boek-preventie (§4/§7): de overlap-check
   * en de insert gebeuren als één ondeelbare operatie.
   * Gooit SlotUnavailableError bij overlap.
   */
  createBookingAtomically(booking: Booking): Promise<Booking>;

  updateBooking(booking: Booking): Promise<Booking>;
}
