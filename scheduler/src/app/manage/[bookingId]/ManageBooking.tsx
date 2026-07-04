'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import type { Slot } from '@/core/types';
import { guestCancelAction, guestRescheduleAction } from './actions';

export default function ManageBooking(props: {
  bookingId: string;
  token: string;
  tenantSlug: string;
  eventTypeSlug: string;
  guestTimezone: string;
}) {
  const [mode, setMode] = useState<'idle' | 'reschedule'>('idle');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [state, formAction, pending] = useActionState(guestRescheduleAction, {});

  useEffect(() => {
    if (mode !== 'reschedule') return;
    setLoading(true);
    const from = DateTime.utc().toISO();
    const to = DateTime.utc().plus({ days: 21 }).toISO();
    fetch(`/api/tenants/${props.tenantSlug}/event-types/${props.eventTypeSlug}/slots?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setLoading(false));
  }, [mode, props.tenantSlug, props.eventTypeSlug]);

  const grouped = useMemo(() => groupByDay(slots, props.guestTimezone), [slots, props.guestTimezone]);

  return (
    <div style={{ marginTop: '1rem' }}>
      {mode === 'idle' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="primary" onClick={() => setMode('reschedule')}>
            Afspraak verzetten
          </button>
          <form action={guestCancelAction}>
            <input type="hidden" name="bookingId" value={props.bookingId} />
            <input type="hidden" name="token" value={props.token} />
            <button type="submit">Annuleren</button>
          </form>
        </div>
      )}

      {mode === 'reschedule' && (
        <div>
          <p className="muted">Kies een nieuw tijdstip ({props.guestTimezone}):</p>
          {loading && <p className="muted">Beschikbaarheid laden…</p>}
          {!loading && grouped.length === 0 && (
            <div className="notice">Geen beschikbare tijden gevonden.</div>
          )}
          {grouped.map((day) => (
            <div className="day-group" key={day.label}>
              <div className="day-label">{day.label}</div>
              <div className="slot-grid">
                {day.slots.map((s) => (
                  <button
                    key={s.startUtc}
                    className={selected === s.startUtc ? 'selected' : ''}
                    onClick={() => setSelected(s.startUtc)}
                  >
                    {DateTime.fromISO(s.startUtc, { zone: 'utc' })
                      .setZone(props.guestTimezone)
                      .toFormat('HH:mm')}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {state?.error && <div className="notice error">{state.error}</div>}

          <form action={formAction} style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <input type="hidden" name="bookingId" value={props.bookingId} />
            <input type="hidden" name="token" value={props.token} />
            <input type="hidden" name="newStartUtc" value={selected} />
            <button type="button" onClick={() => setMode('idle')} disabled={pending}>
              ← Terug
            </button>
            <button className="primary" type="submit" disabled={pending || !selected} style={{ flex: 1 }}>
              {pending ? 'Bezig…' : 'Bevestig nieuw tijdstip'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function groupByDay(slots: Slot[], tz: string): { label: string; slots: Slot[] }[] {
  const map = new Map<string, Slot[]>();
  for (const s of slots) {
    const key = DateTime.fromISO(s.startUtc, { zone: 'utc' }).setZone(tz).toISODate()!;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, slots]) => ({
      label: DateTime.fromISO(key, { zone: tz }).setLocale('nl').toFormat('cccc d LLLL'),
      slots,
    }));
}
