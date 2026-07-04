import { NextResponse } from 'next/server';
import { getBookingService } from '@/config';
import { DomainError, SlotUnavailableError, ValidationError } from '@/core/errors';

/**
 * POST /api/tenants/:tenant/bookings
 * Body: { eventTypeSlug, guestName, guestEmail, guestTimezone, startUtc, idempotencyKey? }
 * Maakt een boeking aan met dubbel-boek-preventie + idempotentie (§4/§7).
 */
export async function POST(req: Request, ctx: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await ctx.params;
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json', message: 'Ongeldige body.' }, { status: 400 });
  }

  try {
    const service = getBookingService();
    const booking = await service.createBooking({
      tenantSlug: tenant,
      eventTypeSlug: body.eventTypeSlug,
      guestName: body.guestName,
      guestEmail: body.guestEmail,
      guestTimezone: body.guestTimezone,
      startUtc: body.startUtc,
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json(
      {
        id: booking.id,
        startUtc: booking.startUtc,
        endUtc: booking.endUtc,
        status: booking.status,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 422 });
    }
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: 'internal', message: 'Er ging iets mis.' }, { status: 500 });
  }
}
