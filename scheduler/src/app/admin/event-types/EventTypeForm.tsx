'use client';

import { useActionState } from 'react';
import type { EventType } from '@/core/types';
import { saveEventTypeAction } from '../actions';

export default function EventTypeForm({ initial }: { initial?: EventType }) {
  const [state, formAction, pending] = useActionState(saveEventTypeAction, {});
  return (
    <form action={formAction}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <label htmlFor="name">Naam</label>
      <input id="name" name="name" defaultValue={initial?.name ?? ''} required />

      <label htmlFor="slug">Slug (in de URL)</label>
      <input id="slug" name="slug" defaultValue={initial?.slug ?? ''} placeholder="intake" required />

      <label htmlFor="description">Omschrijving</label>
      <input id="description" name="description" defaultValue={initial?.description ?? ''} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        <div>
          <label htmlFor="durationMin">Duur (min)</label>
          <input id="durationMin" name="durationMin" type="number" min={5} defaultValue={initial?.durationMin ?? 30} />
        </div>
        <div>
          <label htmlFor="slotGranularityMin">Raster (min)</label>
          <input id="slotGranularityMin" name="slotGranularityMin" type="number" min={5} defaultValue={initial?.slotGranularityMin ?? ''} placeholder="= duur" />
        </div>
        <div>
          <label htmlFor="bufferBeforeMin">Buffer vóór (min)</label>
          <input id="bufferBeforeMin" name="bufferBeforeMin" type="number" min={0} defaultValue={initial?.bufferBeforeMin ?? 0} />
        </div>
        <div>
          <label htmlFor="bufferAfterMin">Buffer ná (min)</label>
          <input id="bufferAfterMin" name="bufferAfterMin" type="number" min={0} defaultValue={initial?.bufferAfterMin ?? 0} />
        </div>
        <div>
          <label htmlFor="minNoticeMin">Min. aankondiging (min)</label>
          <input id="minNoticeMin" name="minNoticeMin" type="number" min={0} defaultValue={initial?.minNoticeMin ?? 120} />
        </div>
        <div>
          <label htmlFor="locationType">Locatie</label>
          <select id="locationType" name="locationType" defaultValue={initial?.locationType ?? 'video'} style={{ width: '100%', padding: '0.6rem 0.7rem', borderRadius: 8, border: '1px solid var(--sage-green)' }}>
            <option value="video">Video</option>
            <option value="phone">Telefoon</option>
            <option value="in_person">Op locatie</option>
          </select>
        </div>
      </div>

      {state?.error && <div className="notice error">{state.error}</div>}
      <button className="primary" type="submit" disabled={pending} style={{ marginTop: '1rem' }}>
        {pending ? 'Opslaan…' : initial ? 'Wijzigingen opslaan' : 'Afspraaktype aanmaken'}
      </button>
    </form>
  );
}
