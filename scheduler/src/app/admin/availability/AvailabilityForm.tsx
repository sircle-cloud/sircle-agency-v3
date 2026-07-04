'use client';

import { useActionState } from 'react';
import type { AvailabilityRule } from '@/core/types';
import { saveAvailabilityAction } from '../actions';

const DAYS = [
  { weekday: 1, label: 'Maandag' },
  { weekday: 2, label: 'Dinsdag' },
  { weekday: 3, label: 'Woensdag' },
  { weekday: 4, label: 'Donderdag' },
  { weekday: 5, label: 'Vrijdag' },
  { weekday: 6, label: 'Zaterdag' },
  { weekday: 7, label: 'Zondag' },
];

function toHHmm(minutes?: number): string {
  if (minutes === undefined) return '';
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export default function AvailabilityForm({
  rules,
  timezone,
}: {
  rules: AvailabilityRule[];
  timezone: string;
}) {
  const [state, formAction, pending] = useActionState(saveAvailabilityAction, {});
  const byDay = new Map(rules.map((r) => [r.weekday, r]));

  return (
    <form action={formAction}>
      <input type="hidden" name="timezone" value={timezone} />
      <p className="muted">Tijdzone: {timezone}. Laat leeg om een dag niet beschikbaar te maken.</p>
      <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.5rem' }}>
        {DAYS.map((d) => {
          const r = byDay.get(d.weekday);
          return (
            <div key={d.weekday} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
              <span>{d.label}</span>
              <input type="time" name={`start_${d.weekday}`} defaultValue={toHHmm(r?.startMinutes)} />
              <input type="time" name={`end_${d.weekday}`} defaultValue={toHHmm(r?.endMinutes)} />
            </div>
          );
        })}
      </div>
      {state?.error && <div className="notice error">{state.error}</div>}
      {state?.ok && <div className="notice success">Beschikbaarheid opgeslagen.</div>}
      <button className="primary" type="submit" disabled={pending} style={{ marginTop: '1rem' }}>
        {pending ? 'Opslaan…' : 'Beschikbaarheid opslaan'}
      </button>
    </form>
  );
}
