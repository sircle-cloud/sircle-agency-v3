import { getRepository } from '@/config';
import type { Booking } from '@/core/types';
import { formatInZone } from '@/core/time';

export const dynamic = 'force-dynamic';

/**
 * Minimaal admin-overzicht (demo). In Fase 2 wordt dit een echt dashboard met
 * auth per tenant (§8). Hier leest het alle boekingen uit de in-memory repo.
 */
export default async function AdminPage() {
  const repo = getRepository() as unknown as { _allBookings?: () => Promise<Booking[]> };
  const bookings = (await repo._allBookings?.()) ?? [];

  return (
    <>
      <div className="brandbar">
        <div className="name">SIRCLE Planner — Admin</div>
        <div className="sub">boekingen (demo)</div>
      </div>
      <div className="container">
        <div className="card">
          <h1>Boekingen</h1>
          {bookings.length === 0 ? (
            <p className="muted">
              Nog geen boekingen. Maak er een via de{' '}
              <a href="/sircle/intake">boekingspagina</a>.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
              {bookings.map((b) => (
                <li key={b.id} className="card" style={{ padding: '0.75rem 1rem' }}>
                  <strong>{b.guestName}</strong> — {b.guestEmail}
                  {b.status === 'cancelled' && <span className="tag">geannuleerd</span>}
                  <br />
                  <span className="muted">
                    {formatInZone(b.startUtc, b.guestTimezone)} ({b.guestTimezone})
                    {b.externalEventId && ` · agenda: ${b.externalEventId}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
