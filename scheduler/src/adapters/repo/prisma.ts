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
    return u ? { id: u.id, tenantId: u.tenantId, email: u.email, name: u.name } : null;
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
    createdAt: b.createdAt.toISOString(),
  });
}
