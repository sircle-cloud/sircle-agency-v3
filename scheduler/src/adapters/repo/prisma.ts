/**
 * PrismaRepository — productie-persistentie op PostgreSQL. De dubbel-boek-guard
 * leunt op de Postgres EXCLUSION-constraint uit
 * prisma/migrations/manual/0001_booking_no_overlap.sql: een overlappende insert
 * gooit een DB-fout (SQLState 23P01), die we hier naar SlotUnavailableError
 * vertalen (§7).
 */
import { PrismaClient } from '@prisma/client';
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

export class PrismaRepository implements BookingRepository {
  constructor(private prisma: PrismaClient) {}

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const t = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!t) return null;
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      timezone: t.timezone,
      branding: (t.brandingJson as Tenant['branding']) ?? undefined,
    };
  }

  async getEventType(tenantId: string, slug: string): Promise<EventType | null> {
    const e = await this.prisma.eventType.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (!e) return null;
    return {
      id: e.id,
      tenantId: e.tenantId,
      hostUserId: e.hostUserId,
      slug: e.slug,
      name: e.name,
      description: e.description ?? undefined,
      durationMin: e.durationMin,
      slotGranularityMin: e.slotGranularityMin ?? undefined,
      bufferBeforeMin: e.bufferBeforeMin,
      bufferAfterMin: e.bufferAfterMin,
      minNoticeMin: e.minNoticeMin,
      locationType: e.locationType as EventType['locationType'],
    };
  }

  async getUser(tenantId: string, userId: string): Promise<User | null> {
    const u = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    return u ? this.userToDomain(u) : null;
  }

  private userToDomain(u: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    passwordHash: string | null;
  }): User {
    return {
      id: u.id,
      tenantId: u.tenantId,
      email: u.email,
      name: u.name,
      passwordHash: u.passwordHash ?? undefined,
    };
  }

  async getRules(tenantId: string, userId: string): Promise<AvailabilityRule[]> {
    const rows = await this.prisma.availabilityRule.findMany({ where: { tenantId, userId } });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      userId: r.userId,
      weekday: r.weekday,
      startMinutes: r.startMinutes,
      endMinutes: r.endMinutes,
      timezone: r.timezone,
    }));
  }

  async getBlockedDates(tenantId: string, userId: string): Promise<BlockedDate[]> {
    const rows = await this.prisma.blockedDate.findMany({ where: { tenantId, userId } });
    return rows.map((b) => ({
      id: b.id,
      tenantId: b.tenantId,
      userId: b.userId,
      dateFrom: b.dateFrom,
      dateTo: b.dateTo,
    }));
  }

  async getCalendarConnectionRef(tenantId: string, userId: string): Promise<string | null> {
    const c = await this.prisma.calendarConnection.findFirst({
      where: { tenantId, userId, status: 'active' },
    });
    return c?.connectionRef ?? null;
  }

  async listBookings(params: {
    tenantId: string;
    hostUserId: string;
    fromUtc: string;
    toUtc: string;
  }): Promise<Booking[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        tenantId: params.tenantId,
        hostUserId: params.hostUserId,
        status: 'confirmed',
        startUtc: { lt: new Date(params.toUtc) },
        endUtc: { gt: new Date(params.fromUtc) },
      },
    });
    return rows.map(this.toDomain);
  }

  async findByIdempotencyKey(tenantId: string, key: string): Promise<Booking | null> {
    const b = await this.prisma.booking.findFirst({ where: { tenantId, idempotencyKey: key } });
    return b ? this.toDomain(b) : null;
  }

  async createBookingAtomically(booking: Booking): Promise<Booking> {
    try {
      const b = await this.prisma.booking.create({
        data: {
          id: booking.id,
          tenantId: booking.tenantId,
          eventTypeId: booking.eventTypeId,
          hostUserId: booking.hostUserId,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          guestTimezone: booking.guestTimezone,
          startUtc: new Date(booking.startUtc),
          endUtc: new Date(booking.endUtc),
          status: booking.status,
          externalEventId: booking.externalEventId,
          idempotencyKey: booking.idempotencyKey,
          createdAt: new Date(booking.createdAt),
        },
      });
      return this.toDomain(b);
    } catch (err: unknown) {
      // Postgres exclusion_violation (23P01) of unique idempotency-botsing → slot bezet.
      const msg = String((err as { message?: string })?.message ?? err);
      if (msg.includes('23P01') || msg.includes('booking_no_overlap') || msg.includes('P2002')) {
        throw new SlotUnavailableError();
      }
      throw err;
    }
  }

  async updateBooking(booking: Booking): Promise<Booking> {
    const b = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: booking.status,
        externalEventId: booking.externalEventId,
      },
    });
    return this.toDomain(b);
  }

  // ---- Admin/beheer (Fase 2) ----

  async getUserByEmail(email: string): Promise<User | null> {
    const u = await this.prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    return u ? this.userToDomain(u) : null;
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) return null;
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      timezone: t.timezone,
      branding: (t.brandingJson as Tenant['branding']) ?? undefined,
    };
  }

  async createTenant(tenant: Tenant): Promise<Tenant> {
    await this.prisma.tenant.create({
      data: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        timezone: tenant.timezone,
        brandingJson: tenant.branding ?? undefined,
      },
    });
    return tenant;
  }

  async createUser(user: User): Promise<User> {
    await this.prisma.user.create({
      data: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash ?? null,
      },
    });
    return user;
  }

  async listEventTypes(tenantId: string): Promise<EventType[]> {
    const rows = await this.prisma.eventType.findMany({ where: { tenantId } });
    return rows.map((e) => ({
      id: e.id,
      tenantId: e.tenantId,
      hostUserId: e.hostUserId,
      slug: e.slug,
      name: e.name,
      description: e.description ?? undefined,
      durationMin: e.durationMin,
      slotGranularityMin: e.slotGranularityMin ?? undefined,
      bufferBeforeMin: e.bufferBeforeMin,
      bufferAfterMin: e.bufferAfterMin,
      minNoticeMin: e.minNoticeMin,
      locationType: e.locationType as EventType['locationType'],
    }));
  }

  async saveEventType(e: EventType): Promise<EventType> {
    const data = {
      tenantId: e.tenantId,
      hostUserId: e.hostUserId,
      slug: e.slug,
      name: e.name,
      description: e.description ?? null,
      durationMin: e.durationMin,
      slotGranularityMin: e.slotGranularityMin ?? null,
      bufferBeforeMin: e.bufferBeforeMin,
      bufferAfterMin: e.bufferAfterMin,
      minNoticeMin: e.minNoticeMin,
      locationType: e.locationType,
    };
    await this.prisma.eventType.upsert({
      where: { id: e.id },
      create: { id: e.id, ...data },
      update: data,
    });
    return e;
  }

  async deleteEventType(tenantId: string, eventTypeId: string): Promise<void> {
    await this.prisma.eventType.deleteMany({ where: { id: eventTypeId, tenantId } });
  }

  async replaceAvailability(
    tenantId: string,
    userId: string,
    rules: AvailabilityRule[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.availabilityRule.deleteMany({ where: { tenantId, userId } }),
      this.prisma.availabilityRule.createMany({
        data: rules.map((r) => ({
          id: r.id,
          tenantId: r.tenantId,
          userId: r.userId,
          weekday: r.weekday,
          startMinutes: r.startMinutes,
          endMinutes: r.endMinutes,
          timezone: r.timezone,
        })),
      }),
    ]);
  }

  async listTenantBookings(tenantId: string, fromUtc: string): Promise<Booking[]> {
    const rows = await this.prisma.booking.findMany({
      where: { tenantId, endUtc: { gte: new Date(fromUtc) } },
      orderBy: { startUtc: 'asc' },
    });
    return rows.map(this.toDomain);
  }

  async getBooking(tenantId: string, bookingId: string): Promise<Booking | null> {
    const b = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    return b ? this.toDomain(b) : null;
  }

  async getCalendarConnection(
    tenantId: string,
    userId: string,
  ): Promise<CalendarConnectionInfo | null> {
    const c = await this.prisma.calendarConnection.findFirst({
      where: { tenantId, userId, status: 'active' },
    });
    return c ? { provider: c.provider, connectionRef: c.connectionRef, status: c.status } : null;
  }

  async saveCalendarConnection(params: {
    tenantId: string;
    userId: string;
    provider: string;
    connectionRef: string;
  }): Promise<void> {
    await this.prisma.calendarConnection.upsert({
      where: {
        tenantId_userId_provider: {
          tenantId: params.tenantId,
          userId: params.userId,
          provider: params.provider,
        },
      },
      create: { ...params, status: 'active' },
      update: { connectionRef: params.connectionRef, status: 'active' },
    });
  }

  async listActiveConnections(): Promise<Array<{ tenantId: string; userId: string }>> {
    const rows = await this.prisma.calendarConnection.findMany({
      where: { status: 'active' },
      select: { tenantId: true, userId: true },
    });
    return rows;
  }

  async findConnectionByGrantId(
    grantId: string,
  ): Promise<{ tenantId: string; userId: string } | null> {
    const c = await this.prisma.calendarConnection.findFirst({
      where: { connectionRef: { startsWith: `${grantId}|` }, status: 'active' },
      select: { tenantId: true, userId: true },
    });
    return c ?? null;
  }

  async updateConnectionStatus(tenantId: string, userId: string, status: string): Promise<void> {
    await this.prisma.calendarConnection.updateMany({
      where: { tenantId, userId },
      data: { status },
    });
  }

  async listBookingsForReminders(nowUtc: string, untilUtc: string): Promise<Booking[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        status: 'confirmed',
        reminderSentAt: null,
        startUtc: { gte: new Date(nowUtc), lte: new Date(untilUtc) },
      },
      orderBy: { startUtc: 'asc' },
    });
    return rows.map(this.toDomain);
  }

  async markReminderSent(bookingId: string, sentAtUtc: string): Promise<void> {
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { reminderSentAt: new Date(sentAtUtc) },
    });
  }

  async findBookingById(bookingId: string): Promise<Booking | null> {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    return b ? this.toDomain(b) : null;
  }

  async getEventTypeById(tenantId: string, eventTypeId: string): Promise<EventType | null> {
    const e = await this.prisma.eventType.findFirst({ where: { id: eventTypeId, tenantId } });
    if (!e) return null;
    return {
      id: e.id,
      tenantId: e.tenantId,
      hostUserId: e.hostUserId,
      slug: e.slug,
      name: e.name,
      description: e.description ?? undefined,
      durationMin: e.durationMin,
      slotGranularityMin: e.slotGranularityMin ?? undefined,
      bufferBeforeMin: e.bufferBeforeMin,
      bufferAfterMin: e.bufferAfterMin,
      minNoticeMin: e.minNoticeMin,
      locationType: e.locationType as EventType['locationType'],
    };
  }

  async rescheduleBookingAtomically(booking: Booking): Promise<Booking> {
    try {
      const b = await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          startUtc: new Date(booking.startUtc),
          endUtc: new Date(booking.endUtc),
          externalEventId: booking.externalEventId ?? null,
        },
      });
      return this.toDomain(b);
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? err);
      if (msg.includes('23P01') || msg.includes('booking_no_overlap')) {
        throw new SlotUnavailableError();
      }
      throw err;
    }
  }

  private toDomain = (b: {
    id: string;
    tenantId: string;
    eventTypeId: string;
    hostUserId: string;
    guestName: string;
    guestEmail: string;
    guestTimezone: string;
    startUtc: Date;
    endUtc: Date;
    status: string;
    externalEventId: string | null;
    idempotencyKey: string | null;
    reminderSentAt: Date | null;
    createdAt: Date;
  }): Booking => ({
    id: b.id,
    tenantId: b.tenantId,
    eventTypeId: b.eventTypeId,
    hostUserId: b.hostUserId,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    guestTimezone: b.guestTimezone,
    startUtc: b.startUtc.toISOString(),
    endUtc: b.endUtc.toISOString(),
    status: b.status as Booking['status'],
    externalEventId: b.externalEventId ?? undefined,
    idempotencyKey: b.idempotencyKey ?? undefined,
    reminderSentAt: b.reminderSentAt?.toISOString() ?? undefined,
    createdAt: b.createdAt.toISOString(),
  });
}
