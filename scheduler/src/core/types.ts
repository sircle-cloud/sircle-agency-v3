/**
 * Domein-types. Dit is de EIGEN domeinlaag (§6/§7 van het plan): onafhankelijk
 * van Nylas, Prisma of welke leverancier dan ook. Adapters vertalen naar/van
 * deze types, zodat we later van sync-provider of database kunnen wisselen
 * zonder de kern te herschrijven.
 *
 * Tijdconventie: alle absolute momenten worden opgeslagen als UTC ISO-8601
 * strings, altijd samen met de originele IANA-tijdzone (bv. "Europe/Amsterdam").
 * Nooit een vaste offset opslaan — zie §4/§7 (DST-drift).
 */

export type LocationType = 'video' | 'phone' | 'in_person';

export type BookingStatus = 'confirmed' | 'cancelled';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  timezone: string; // IANA, default voor event-types
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
  };
  /** Abonnement (facturatie). 'free' tot er een plan wordt afgenomen. */
  plan?: string;
  subscriptionStatus?: string; // active | past_due | canceled | ...
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  /** scrypt-hash (`salt:hash`) voor admin-login. Optioneel: gasten hebben geen account. */
  passwordHash?: string;
}

/** Status van een agenda-koppeling voor de admin-UI. */
export interface CalendarConnectionInfo {
  provider: string;
  connectionRef: string;
  status: string;
}

export interface EventType {
  id: string;
  tenantId: string;
  /** Eigenaar/standaard-host. */
  hostUserId: string;
  /**
   * Round-robin: als hier >1 host staat, wordt een boeking verdeeld over de
   * beschikbare hosts. Leeg/undefined = alleen `hostUserId` (single host).
   */
  hostUserIds?: string[];
  slug: string;
  name: string;
  description?: string;
  durationMin: number;
  /** Granulariteit van de slot-raster in minuten (bv. elke 15 min). Default = duur. */
  slotGranularityMin?: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  /** Minimale aankondigingstijd: hoe ver vooruit moet een slot minimaal liggen. */
  minNoticeMin: number;
  locationType: LocationType;
}

/**
 * Wekelijkse beschikbaarheidsregel. `weekday` volgt Luxon/ISO: 1 = maandag ...
 * 7 = zondag. Tijden zijn minuten vanaf middernacht in `timezone` (lokale
 * wandklok), zodat DST correct wordt afgehandeld.
 */
export interface AvailabilityRule {
  id: string;
  tenantId: string;
  userId: string;
  weekday: number; // 1..7 (ma..zo)
  startMinutes: number; // 0..1440
  endMinutes: number; // 0..1440
  timezone: string; // IANA
}

/** Geblokkeerde dag(en) — vakantie, etc. Datums in `YYYY-MM-DD` lokale interpretatie. */
export interface BlockedDate {
  id: string;
  tenantId: string;
  userId: string;
  dateFrom: string; // YYYY-MM-DD (inclusief)
  dateTo: string; // YYYY-MM-DD (inclusief)
}

/**
 * Een bezet-interval uit de agenda van de host, geleverd door de
 * CalendarProvider (free/busy). Bevat bewust géén titel/details (privacy, §4).
 */
export interface BusyInterval {
  startUtc: string; // ISO
  endUtc: string; // ISO
}

export interface Booking {
  id: string;
  tenantId: string;
  eventTypeId: string;
  hostUserId: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string; // IANA van de gast
  startUtc: string; // ISO
  endUtc: string; // ISO
  status: BookingStatus;
  /** ID van het aangemaakte event in de externe agenda (voor update/delete). */
  externalEventId?: string;
  /** Idempotency-key tegen dubbele submits (§4/§7). */
  idempotencyKey?: string;
  /** Moment waarop de herinneringsmail is verstuurd (voorkomt dubbele reminders). */
  reminderSentAt?: string; // ISO
  createdAt: string; // ISO
}

/** Een aanbod-slot dat aan de gast wordt getoond. */
export interface Slot {
  startUtc: string; // ISO
  endUtc: string; // ISO
}

/** De effectieve host-pool van een afspraaktype (round-robin of single). */
export function effectiveHostIds(eventType: EventType): string[] {
  return eventType.hostUserIds && eventType.hostUserIds.length > 0
    ? eventType.hostUserIds
    : [eventType.hostUserId];
}
