import Link from 'next/link';
import { getRepository } from '@/config';

/** Home: overzicht van de demo-tenant en zijn afspraaktypes. */
export default async function Home() {
  const repo = getRepository();
  const tenant = await repo.getTenantBySlug('sircle');
  const eventTypes = tenant
    ? await Promise.all(
        ['intake', 'adviesgesprek'].map((slug) => repo.getEventType(tenant.id, slug)),
      )
    : [];

  return (
    <>
      <div className="brandbar">
        <div className="name">SIRCLE Planner</div>
        <div className="sub">white-label afsprakenplanner — Fase 1 demo</div>
      </div>
      <div className="container">
        <div className="card">
          <h1>Demo: {tenant?.name}</h1>
          <p className="muted">
            Draait op in-memory data + mock-agenda (geen Nylas-keys nodig). Kies een
            afspraaktype om de boekingsflow te bekijken.
          </p>
          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
            {eventTypes.filter(Boolean).map((et) => (
              <Link
                key={et!.id}
                href={`/sircle/${et!.slug}`}
                className="btn"
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <strong>{et!.name}</strong>
                <span className="muted"> — {et!.durationMin} min</span>
              </Link>
            ))}
          </div>
          <p className="muted" style={{ marginTop: '1.5rem' }}>
            <Link href="/signup">→ Nieuwe organisatie aanmaken (onboarding)</Link>
            <br />
            <Link href="/admin">→ Admin: inloggen &amp; beheren</Link>
            <br />
            <Link href="/sircle/intake?embed=1">→ Embed-weergave (iframe-modus)</Link>
          </p>
        </div>
      </div>
    </>
  );
}
