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
  CalendarConnectionInfo,
  EventType,
  Tenant,
  User,
} from '../../core/types';
import { SlotUnavailableError } from '../../core/errors';
import { intervalsOverlap } from '../../core/time';
import { buildSeed, type SeedData } from '../seed';

export class MemoryRepository implements BookingRepository {
  private data: SeedData;
  private connInfo = new Map<string, CalendarConnectionInfo>();

  constructor(seed: SeedData = buildSeed()) {
    // Diepe kopie zodat tests elkaar niet beïnvloeden.
    this.data = structuredClone(seed);
    for (const [key, ref] of Object.entries(this.data.connections)) {
      if (ref) this.connInfo.set(key, { provider: 'nylas', connectionRef: ref, status: 'active' });
    }
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
    return this.connInfo.get(`${tenantId}:${userId}`)?.connectionRef ?? null;
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

  // ---- Admin/beheer (Fase 2) ----

  async getUserByEmail(email: string): Promise<User | null> {
    return this.data.users.find((u) => u.email === email.toLowerCase()) ?? null;
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    return this.data.tenants.find((t) => t.id === tenantId) ?? null;
  }

  async createTenant(tenant: Tenant): Promise<Tenant> {
    this.data.tenants.push({ ...tenant });
    return tenant;
  }

  async createUser(user: User): Promise<User> {
    this.data.users.push({ ...user });
    return user;
  }

  async listUsers(tenantId: string): Promise<User[]> {
    return this.data.users.filter((u) => u.tenantId === tenantId);
  }

  async updateTenantBilling(
    tenantId: string,
    fields: {
      plan?: string;
      subscriptionStatus?: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    },
  ): Promise<void> {
    const t = this.data.tenants.find((x) => x.id === tenantId);
    if (!t) return;
    if (fields.plan !== undefined) t.plan = fields.plan;
    if (fields.subscriptionStatus !== undefined) t.subscriptionStatus = fields.subscriptionStatus;
    if (fields.stripeCustomerId !== undefined) t.stripeCustomerId = fields.stripeCustomerId;
    if (fields.stripeSubscriptionId !== undefined)
      t.stripeSubscriptionId = fields.stripeSubscriptionId;
  }

  async listEventTypes(tenantId: string): Promise<EventType[]> {
    return this.data.eventTypes.filter((e) => e.tenantId === tenantId);
  }

  async saveEventType(eventType: EventType): Promise<EventType> {
    const idx = this.data.eventTypes.findIndex(
      (e) => e.tenantId === eventType.tenantId && e.id === eventType.id,
    );
    if (idx >= 0) this.data.eventTypes[idx] = { ...eventType };
    else this.data.eventTypes.push({ ...eventType });
    return eventType;
  }

  async deleteEventType(tenantId: string, eventTypeId: string): Promise<void> {
    this.data.eventTypes = this.data.eventTypes.filter(
      (e) => !(e.tenantId === tenantId && e.id === eventTypeId),
    );
  }

  async replaceAvailability(
    tenantId: string,
    userId: string,
    rules: AvailabilityRule[],
  ): Promise<void> {
    this.data.rules = this.data.rules.filter(
      (r) => !(r.tenantId === tenantId && r.userId === userId),
    );
    this.data.rules.push(...rules.map((r) => ({ ...r })));
  }

  async listTenantBookings(tenantId: string, fromUtc: string): Promise<Booking[]> {
    return this.data.bookings
      .filter((b) => b.tenantId === tenantId && b.endUtc >= fromUtc)
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  }

  async getBooking(tenantId: string, bookingId: string): Promise<Booking | null> {
    return this.data.bookings.find((b) => b.tenantId === tenantId && b.id === bookingId) ?? null;
  }

  async getCalendarConnection(
    tenantId: string,
    userId: string,
  ): Promise<CalendarConnectionInfo | null> {
    return this.connInfo.get(`${tenantId}:${userId}`) ?? null;
  }

  async saveCalendarConnection(params: {
    tenantId: string;
    userId: string;
    provider: string;
    connectionRef: string;
  }): Promise<void> {
    this.connInfo.set(`${params.tenantId}:${params.userId}`, {
      provider: params.provider,
      connectionRef: params.connectionRef,
      status: 'active',
    });
  }

  async listActiveConnections(): Promise<Array<{ tenantId: string; userId: string }>> {
    const out: Array<{ tenantId: string; userId: string }> = [];
    for (const [key, info] of this.connInfo.entries()) {
      if (info.status !== 'active') continue;
      const [tenantId, userId] = key.split(':');
      out.push({ tenantId, userId });
    }
    return out;
  }

  async findConnectionByGrantId(
    grantId: string,
  ): Promise<{ tenantId: string; userId: string } | null> {
    for (const [key, info] of this.connInfo.entries()) {
      if (info.connectionRef.split('|')[0] === grantId) {
        const [tenantId, userId] = key.split(':');
        return { tenantId, userId };
      }
    }
    return null;
  }

  async updateConnectionStatus(tenantId: string, userId: string, status: string): Promise<void> {
    const key = `${tenantId}:${userId}`;
    const info = this.connInfo.get(key);
    if (info) this.connInfo.set(key, { ...info, status });
  }

  async listBookingsForReminders(nowUtc: string, untilUtc: string): Promise<Booking[]> {
    return this.data.bookings.filter(
      (b) =>
        b.status === 'confirmed' &&
        !b.reminderSentAt &&
        b.startUtc >= nowUtc &&
        b.startUtc <= untilUtc,
    );
  }

  async markReminderSent(bookingId: string, sentAtUtc: string): Promise<void> {
    const b = this.data.bookings.find((x) => x.id === bookingId);
    if (b) b.reminderSentAt = sentAtUtc;
  }

  async findBookingById(bookingId: string): Promise<Booking | null> {
    return this.data.bookings.find((b) => b.id === bookingId) ?? null;
  }

  async getEventTypeById(tenantId: string, eventTypeId: string): Promise<EventType | null> {
    return (
      this.data.eventTypes.find((e) => e.tenantId === tenantId && e.id === eventTypeId) ?? null
    );
  }

  async rescheduleBookingAtomically(booking: Booking): Promise<Booking> {
    // Atomair: overlap-check tegen ANDERE bevestigde boekingen, dan updaten.
    const conflict = this.data.bookings.some(
      (b) =>
        b.id !== booking.id &&
        b.tenantId === booking.tenantId &&
        b.hostUserId === booking.hostUserId &&
        b.status === 'confirmed' &&
        intervalsOverlap(b.startUtc, b.endUtc, booking.startUtc, booking.endUtc),
    );
    if (conflict) throw new SlotUnavailableError();
    const idx = this.data.bookings.findIndex((b) => b.id === booking.id);
    if (idx >= 0) this.data.bookings[idx] = { ...booking };
    return booking;
  }

  /** Alleen voor het admin-overzicht in de demo. */
  async _allBookings(): Promise<Booking[]> {
    return [...this.data.bookings];
  }
}
