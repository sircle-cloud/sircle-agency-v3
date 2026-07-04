import Link from 'next/link';
import { requireAdmin } from '../guard';
import { getAdminService } from '@/config';
import { deleteEventTypeAction } from '../actions';
import EventTypeForm from './EventTypeForm';

export const dynamic = 'force-dynamic';

export default async function EventTypesPage(props: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { tenant } = await requireAdmin();
  const { edit } = await props.searchParams;

  const eventTypes = await getAdminService().listEventTypes(tenant.id);
  const editing = edit ? eventTypes.find((e) => e.id === edit) : undefined;

  return (
    <>
      <div className="brandbar">
        <div className="name">{tenant.name} — Afspraaktypes</div>
        <div className="sub">
          <Link href="/admin" style={{ color: 'var(--sage-green)' }}>← dashboard</Link>
        </div>
      </div>
      <div className="container">
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.1rem' }}>Bestaande afspraaktypes</h1>
          {eventTypes.length === 0 ? (
            <p className="muted">Nog geen afspraaktypes.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
              {eventTypes.map((e) => (
                <li key={e.id} className="card" style={{ padding: '0.6rem 0.9rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <span>
                    <strong>{e.name}</strong> <span className="muted">/{e.slug} · {e.durationMin} min</span>
                  </span>
                  <span style={{ display: 'flex', gap: '0.4rem' }}>
                    <Link className="btn" href={`/admin/event-types?edit=${e.id}`} style={{ padding: '0.3rem 0.6rem' }}>Bewerken</Link>
                    <form action={deleteEventTypeAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" style={{ padding: '0.3rem 0.6rem' }}>Verwijderen</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h1 style={{ fontSize: '1.1rem' }}>{editing ? `Bewerken: ${editing.name}` : 'Nieuw afspraaktype'}</h1>
          <EventTypeForm key={editing?.id ?? 'new'} initial={editing} />
          {editing && (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              <Link href="/admin/event-types">+ Nieuw i.p.v. bewerken</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
