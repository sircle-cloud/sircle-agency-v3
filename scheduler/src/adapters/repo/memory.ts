/**
 * MemoryRepository — in-memory persistentie voor dev/tests. Draait zonder DB,
 * zodat de app hier direct te verifiëren is. De atomaire overlap-guard is
 * betrouwbaar omdat JS single-threaded is: de check-en-insert in
 * `createBookingAtomically` kan niet onderbroken worden door een andere request.
 *
 * In productie vervangt PrismaRepository dit, met een Postgres
 * exclusion-constraint (btree_gist over tstzrange) als harde DB-garantie (§7).
 */
import type { BookingRepository } from '../../ports/index';
import type {
  AvailabilityRule,
  BlockedDate,
  Booking,
  EventType,
  Tenant,
  User,
} from '../../core/types';
import { SlotUnavailableError } from '../../core/errors';
import { intervalsOverlap } from '../../core/time';
import { buildSeed, type SeedData } from '../seed';

export class MemoryRepository implements BookingRepository {
  private data: SeedData;

  constructor(seed: SeedData = buildSeed()) {
    // Diepe kopie zodat tests elkaar niet beïnvloeden.
    this.data = structuredClone(seed);
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.data.tenants.find((t) => t.slug === slug) ?? null;
  }

  async getEventType(tenantId: string, slug: string): Promise<EventType | null> {
    return (
      this.data.eventTypes.find((e) => e.tenantId === tenantId && e.slug === slug) ?? null
    );
  }

  async getUser(tenantId: string, userId: string): Promise<User | null> {
    return this.data.users.find((u) => u.tenantId === tenantId && u.id === userId) ?? null;
  }

  async getRules(tenantId: string, userId: string): Promise<AvailabilityRule[]> {
    return this.data.rules.filter((r) => r.tenantId === tenantId && r.userId === userId);
  }

  async getBlockedDates(tenantId: string, userId: string): Promise<BlockedDate[]> {
    return this.data.blocked.filter((b) => b.tenantId === tenantId && b.userId === userId);
  }

  async getCalendarConnectionRef(tenantId: string, userId: string): Promise<string | null> {
    return this.data.connections[`${tenantId}:${userId}`] ?? null;
  }

  async listBookings(params: {
    tenantId: string;
    hostUserId: string;
    fromUtc: string;
    toUtc: string;
  }): Promise<Booking[]> {
    return this.data.bookings.filter(
      (b) =>
        b.tenantId === params.tenantId &&
        b.hostUserId === params.hostUserId &&
        b.status === 'confirmed' &&
        intervalsOverlap(b.startUtc, b.endUtc, params.fromUtc, params.toUtc),
    );
  }

  async findByIdempotencyKey(tenantId: string, key: string): Promise<Booking | null> {
    return (
      this.data.bookings.find((b) => b.tenantId === tenantId && b.idempotencyKey === key) ?? null
    );
  }

  async createBookingAtomically(booking: Booking): Promise<Booking> {
    // Atomair: geen await tussen de overlap-check en de insert.
    const conflict = this.data.bookings.some(
      (b) =>
        b.tenantId === booking.tenantId &&
        b.hostUserId === booking.hostUserId &&
        b.status === 'confirmed' &&
        intervalsOverlap(b.startUtc, b.endUtc, booking.startUtc, booking.endUtc),
    );
    if (conflict) throw new SlotUnavailableError();
    this.data.bookings.push({ ...booking });
    return booking;
  }

  async updateBooking(booking: Booking): Promise<Booking> {
    const idx = this.data.bookings.findIndex((b) => b.id === booking.id);
    if (idx >= 0) this.data.bookings[idx] = { ...booking };
    return booking;
  }

  /** Alleen voor het admin-overzicht in de demo. */
  async _allBookings(): Promise<Booking[]> {
    return [...this.data.bookings];
  }
}
