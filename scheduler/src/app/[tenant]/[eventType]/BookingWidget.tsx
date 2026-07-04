'use client';

import { useEffect, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import type { Slot } from '@/core/types';

type Phase = 'loading' | 'pick' | 'form' | 'done' | 'error';

export default function BookingWidget(props: {
  tenantSlug: string;
  eventTypeSlug: string;
  durationMin: number;
}) {
  const guestTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam',
    [],
  );
  const [phase, setPhase] = useState<Phase>('loading');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Één idempotency-key per boekingspoging (§4): retries dedupliceren.
  const [idempotencyKey] = useState(
    () => globalThis.crypto?.randomUUID?.() ?? `k_${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    const from = DateTime.utc().toISO();
    const to = DateTime.utc().plus({ days: 21 }).toISO();
    fetch(
      `/api/tenants/${props.tenantSlug}/event-types/${props.eventTypeSlug}/slots?from=${from}&to=${to}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.message);
        setSlots(data.slots ?? []);
        setPhase('pick');
      })
      .catch((e) => {
        setError(String(e.message ?? e));
        setPhase('error');
      });
  }, [props.tenantSlug, props.eventTypeSlug]);

  const grouped = useMemo(() => groupByDay(slots, guestTimezone), [slots, guestTimezone]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/tenants/${props.tenantSlug}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTypeSlug: props.eventTypeSlug,
          guestName: name,
          guestEmail: email,
          guestTimezone,
          startUtc: selected.startUtc,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Er ging iets mis.');
        // Bij 409 (slot bezet): terug naar keuze en slots verversen.
        if (res.status === 409) setPhase('pick');
        return;
      }
      setPhase('done');
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'loading') return <p className="muted">Beschikbaarheid laden…</p>;

  if (phase === 'error')
    return <div className="notice error">Kon beschikbaarheid niet laden: {error}</div>;

  if (phase === 'done' && selected)
    return (
      <div className="notice success">
        <strong>Afspraak bevestigd!</strong>
        <br />
        {formatSlot(selected, guestTimezone)} ({guestTimezone})
        <br />
        Je ontvangt een bevestiging per e-mail.
      </div>
    );

  return (
    <div>
      <p className="muted">
        Tijden in jouw tijdzone: <strong>{guestTimezone}</strong>
      </p>

      {phase === 'pick' && (
        <>
          {grouped.length === 0 && (
            <div className="notice">Geen beschikbare tijden in de komende 3 weken.</div>
          )}
          {grouped.map((day) => (
            <div className="day-group" key={day.label}>
              <div className="day-label">{day.label}</div>
              <div className="slot-grid">
                {day.slots.map((s) => (
                  <button
                    key={s.startUtc}
                    className={selected?.startUtc === s.startUtc ? 'selected' : ''}
                    onClick={() => {
                      setSelected(s);
                      setPhase('form');
                    }}
                  >
                    {timeLabel(s.startUtc, guestTimezone)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {phase === 'form' && selected && (
        <div style={{ marginTop: '1rem' }}>
          <div className="notice success">
            Gekozen: <strong>{formatSlot(selected, guestTimezone)}</strong>
          </div>
          <label htmlFor="name">Naam</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <div className="notice error">{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={() => setPhase('pick')} disabled={submitting}>
              ← Terug
            </button>
            <button
              className="primary"
              onClick={submit}
              disabled={submitting || !name || !email}
              style={{ flex: 1 }}
            >
              {submitting ? 'Bezig…' : 'Afspraak bevestigen'}
            </button>
          </div>
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
      label: DateTime.fromISO(key, { zone: tz })
        .setLocale('nl')
        .toFormat('cccc d LLLL'),
      slots,
    }));
}

function timeLabel(iso: string, tz: string): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz).toFormat('HH:mm');
}

function formatSlot(s: Slot, tz: string): string {
  return DateTime.fromISO(s.startUtc, { zone: 'utc' })
    .setZone(tz)
    .setLocale('nl')
    .toFormat("cccc d LLLL 'om' HH:mm");
}
