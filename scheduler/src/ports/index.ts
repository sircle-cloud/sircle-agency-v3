/**
 * Ports = de interfaces waar de domeinlaag tegenaan praat. Adapters (Nylas,
 * Prisma, Resend, én mocks) implementeren ze. Dit is de kern van de
 * anti-lock-in-strategie uit §6: van sync-provider of database wisselen is een
 * adapter-swap, geen herbouw.
 */
import type {
  Booking,
  BusyInterval,
  CalendarConnectionInfo,
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

  // ---- Admin/beheer (Fase 2) ----

  /** Zoek een gebruiker op e-mail (voor admin-login). Inclusief passwordHash. */
  getUserByEmail(email: string): Promise<User | null>;

  getTenantById(tenantId: string): Promise<Tenant | null>;

  listEventTypes(tenantId: string): Promise<EventType[]>;

  /** Upsert (op id) van een afspraaktype. */
  saveEventType(eventType: EventType): Promise<EventType>;

  deleteEventType(tenantId: string, eventTypeId: string): Promise<void>;

  /** Vervang de volledige set beschikbaarheidsregels van een host. */
  replaceAvailability(
    tenantId: string,
    userId: string,
    rules: AvailabilityRule[],
  ): Promise<void>;

  /** Alle bevestigde boekingen van een tenant vanaf `fromUtc` (voor het dashboard). */
  listTenantBookings(tenantId: string, fromUtc: string): Promise<Booking[]>;

  getBooking(tenantId: string, bookingId: string): Promise<Booking | null>;

  getCalendarConnection(
    tenantId: string,
    userId: string,
  ): Promise<CalendarConnectionInfo | null>;

  /** Sla (of vervang) de agenda-koppeling van een host op — gebruikt na de OAuth-callback. */
  saveCalendarConnection(params: {
    tenantId: string;
    userId: string;
    provider: string;
    connectionRef: string;
  }): Promise<void>;

  // ---- Sync/reconciliatie (Fase 3) ----

  /** Alle actieve agenda-koppelingen (voor de reconciliatie-cron die alles langsloopt). */
  listActiveConnections(): Promise<Array<{ tenantId: string; userId: string }>>;

  /** Zoek de host bij een Nylas grant-id (om een binnenkomende webhook te routeren). */
  findConnectionByGrantId(
    grantId: string,
  ): Promise<{ tenantId: string; userId: string } | null>;

  /** Zet de status van een koppeling (bv. 'inactive' bij grant.expired). */
  updateConnectionStatus(tenantId: string, userId: string, status: string): Promise<void>;
}
