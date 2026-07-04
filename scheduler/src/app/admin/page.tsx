import Link from 'next/link';
import { DateTime } from 'luxon';
import { requireAdmin } from './guard';
import { getAdminService, getRepository, getSyncService } from '@/config';
import { cancelBookingAction, logoutAction } from './actions';
import { formatInZone, nowUtcIso } from '@/core/time';

export const dynamic = 'force-dynamic';

const CALENDAR_MSG: Record<string, string> = {
  connected: 'Agenda gekoppeld! Je beschikbaarheid houdt nu rekening met je agenda.',
  cancelled: 'Agenda-koppeling geannuleerd.',
  error: 'Koppelen mislukt. Probeer het opnieuw.',
  state_error: 'Beveiligingscontrole mislukt. Probeer het opnieuw.',
};

export default async function AdminDashboard(props: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  const { tenant, host } = await requireAdmin();
  const { calendar } = await props.searchParams;

  const service = getAdminService();
  const [bookings, connection] = await Promise.all([
    service.listBookings(tenant.id, nowUtcIso()),
    getRepository().getCalendarConnection(tenant.id, host.id),
  ]);

  // Reconciliatie-backstop: detecteer boekingen waar de host extern iets
  // overheen heeft gepland (§4). Alleen zinvol als er een agenda gekoppeld is.
  const { conflicts } = connection
    ? await getSyncService().reconcileHost({
        tenantId: tenant.id,
        hostUserId: host.id,
        fromUtc: nowUtcIso(),
        toUtc: DateTime.utc().plus({ days: 21 }).toISO()!,
      })
    : { conflicts: [] };
  const conflictIds = new Set(conflicts.map((c) => c.booking.id));

  return (
    <>
      <div className="brandbar">
        <div className="name">{tenant.name} — Admin</div>
        <div className="sub">
          Ingelogd als {host.name} ·{' '}
          <form action={logoutAction} style={{ display: 'inline' }}>
            <button style={{ padding: '0.1rem 0.5rem', fontSize: '0.8rem' }}>uitloggen</button>
          </form>
        </div>
      </div>

      <div className="container">
        {calendar && CALENDAR_MSG[calendar] && (
          <div className={`notice ${calendar === 'connected' ? 'success' : 'error'}`}>
            {CALENDAR_MSG[calendar]}
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="notice error">
            <strong>Let op: {conflicts.length} agenda-conflict(en).</strong> Er staan externe
            afspraken over geboekte tijden. Overweeg deze boekingen te verzetten.
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0', flexWrap: 'wrap' }}>
          <Link className="btn" href="/admin/event-types">Afspraaktypes</Link>
          <Link className="btn" href="/admin/availability">Beschikbaarheid</Link>
          <Link className="btn" href={`/${tenant.slug}/intake`} target="_blank">
            Bekijk boekingspagina ↗
          </Link>
        </div>

        {/* Agenda-koppeling */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.1rem' }}>Agenda-koppeling</h1>
          {connection ? (
            <p className="muted">
              Gekoppeld via <strong>{connection.provider}</strong> (status: {connection.status}).
              Boekingen worden naar je agenda geschreven en bezette tijden geblokkeerd.
            </p>
          ) : (
            <>
              <p className="muted">
                Nog geen agenda gekoppeld. Koppel Google of Outlook zodat dubbele afspraken
                automatisch worden voorkomen.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <a className="btn" href="/api/oauth/nylas/start?provider=google">Google koppelen</a>
                <a className="btn" href="/api/oauth/nylas/start?provider=microsoft">Outlook koppelen</a>
              </div>
            </>
          )}
        </div>

        {/* Boekingen */}
        <div className="card">
          <h1 style={{ fontSize: '1.1rem' }}>Aankomende boekingen</h1>
          {bookings.length === 0 ? (
            <p className="muted">Nog geen boekingen.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
              {bookings.map((b) => (
                <li
                  key={b.id}
                  className="card"
                  style={{ padding: '0.75rem 1rem', opacity: b.status === 'cancelled' ? 0.55 : 1 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{b.guestName}</strong> — {b.guestEmail}
                      {b.status === 'cancelled' && <span className="tag">geannuleerd</span>}
                      {conflictIds.has(b.id) && (
                        <span className="tag" style={{ background: '#fdecec', color: '#8a1c1c' }}>
                          agenda-conflict
                        </span>
                      )}
                      <br />
                      <span className="muted">
                        {formatInZone(b.startUtc, tenant.timezone)} ({tenant.timezone})
                      </span>
                    </div>
                    {b.status === 'confirmed' && (
                      <form action={cancelBookingAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button type="submit">Annuleren</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
