import { NextResponse } from 'next/server';
import { getSyncService, getRepository } from '@/config';
import { DateTime } from 'luxon';

/**
 * Periodieke reconciliatie-backstop (§4). In productie roept een cron (bv.
 * elke 10–15 min, of na een webhook) deze endpoint aan. Beveiligd met een
 * bearer-token (CRON_SECRET) zodat alleen de scheduler 'm kan triggeren.
 *
 * Loopt alle actieve agenda-koppelingen langs, vergelijkt boekingen met de
 * echte agenda en rapporteert conflicten (host heeft er iets overheen gepland).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'not_configured', message: 'CRON_SECRET ontbreekt (zie .env.example).' },
      { status: 501 },
    );
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const fromUtc = DateTime.utc().toISO()!;
  const toUtc = DateTime.utc().plus({ days: 21 }).toISO()!;

  const sync = getSyncService();
  const connections = await getRepository().listActiveConnections();

  let totalChecked = 0;
  const allConflicts: Array<{ tenantId: string; bookingId: string; reason: string }> = [];
  for (const c of connections) {
    const res = await sync.reconcileHost({
      tenantId: c.tenantId,
      hostUserId: c.userId,
      fromUtc,
      toUtc,
    });
    totalChecked += res.checked;
    for (const conflict of res.conflicts) {
      allConflicts.push({
        tenantId: c.tenantId,
        bookingId: conflict.booking.id,
        reason: conflict.reason,
      });
    }
  }

  return NextResponse.json({
    connections: connections.length,
    bookingsChecked: totalChecked,
    conflicts: allConflicts,
  });
}
