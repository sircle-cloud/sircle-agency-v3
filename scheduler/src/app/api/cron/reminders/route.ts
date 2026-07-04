import { NextResponse } from 'next/server';
import { getReminderService } from '@/config';
import { DateTime } from 'luxon';

/**
 * Herinnerings-cron (§5, no-show-reductie). Draai bv. elk uur; verstuurt
 * herinneringen voor afspraken die binnen `leadMinutes` (default 24u) starten.
 * Beveiligd met CRON_SECRET, net als /api/cron/reconcile.
 *
 *   GET /api/cron/reminders?leadMinutes=1440
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'not_configured', message: 'CRON_SECRET ontbreekt (zie .env.example).' },
      { status: 501 },
    );
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const leadParam = new URL(req.url).searchParams.get('leadMinutes');
  const leadMinutes = leadParam ? Number(leadParam) : undefined;

  const result = await getReminderService().sendDueReminders({
    nowUtc: DateTime.utc().toISO()!,
    leadMinutes,
  });
  return NextResponse.json(result);
}
