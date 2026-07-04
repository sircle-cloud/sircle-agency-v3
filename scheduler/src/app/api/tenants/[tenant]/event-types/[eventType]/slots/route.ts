import { NextResponse } from 'next/server';
import { getBookingService } from '@/config';
import { DateTime } from 'luxon';
import { DomainError } from '@/core/errors';

/**
 * GET /api/tenants/:tenant/event-types/:eventType/slots?from=ISO&to=ISO
 * Geeft de beschikbare slots terug. Zonder from/to: de komende 21 dagen.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ tenant: string; eventType: string }> },
) {
  const { tenant, eventType } = await ctx.params;
  const url = new URL(req.url);
  const fromUtc = url.searchParams.get('from') ?? DateTime.utc().toISO()!;
  const toUtc = url.searchParams.get('to') ?? DateTime.utc().plus({ days: 21 }).toISO()!;

  try {
    const service = getBookingService();
    const result = await service.listAvailableSlots({
      tenantSlug: tenant,
      eventTypeSlug: eventType,
      fromUtc,
      toUtc,
    });
    return NextResponse.json({
      tenant: { name: result.tenant.name, timezone: result.tenant.timezone, branding: result.tenant.branding },
      eventType: {
        name: result.eventType.name,
        description: result.eventType.description,
        durationMin: result.eventType.durationMin,
      },
      slots: result.slots,
    });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: 'internal', message: 'Er ging iets mis.' }, { status: 500 });
  }
}
