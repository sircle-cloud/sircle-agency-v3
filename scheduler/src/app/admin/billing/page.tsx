import Link from 'next/link';
import { requireAdmin } from '../guard';
import { getBillingService } from '@/config';

export const dynamic = 'force-dynamic';

const STATUS_MSG: Record<string, { text: string; ok: boolean }> = {
  success: { text: 'Abonnement geactiveerd. Bedankt!', ok: true },
  cancelled: { text: 'Betaling geannuleerd.', ok: false },
  error: { text: 'Er ging iets mis. Probeer het opnieuw.', ok: false },
};

function euro(cents: number): string {
  return `€${(cents / 100).toFixed(0)}`;
}

export default async function BillingPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { tenant } = await requireAdmin();
  const { status } = await props.searchParams;
  const plans = getBillingService().getPlans();
  const currentPlan = tenant.plan ?? 'free';
  const banner = status ? STATUS_MSG[status] : undefined;

  return (
    <>
      <div className="brandbar">
        <div className="name">{tenant.name} — Abonnement</div>
        <div className="sub">
          <Link href="/admin" style={{ color: 'var(--sage-green)' }}>← dashboard</Link>
        </div>
      </div>
      <div className="container">
        {banner && <div className={`notice ${banner.ok ? 'success' : 'error'}`}>{banner.text}</div>}

        <div className="card" style={{ marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.1rem' }}>Huidig abonnement</h1>
          <p>
            Plan:{' '}
            <strong style={{ textTransform: 'capitalize' }}>{currentPlan}</strong>
            {tenant.subscriptionStatus && (
              <span className="muted"> · status: {tenant.subscriptionStatus}</span>
            )}
          </p>
        </div>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {plans.map((p) => (
            <div className="card" key={p.id}>
              <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{p.name}</h2>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.25rem 0' }}>
                {euro(p.priceEurCents)}
                <span className="muted" style={{ fontSize: '0.9rem', fontWeight: 400 }}>/mnd</span>
              </p>
              <ul style={{ paddingLeft: '1.1rem', margin: '0.5rem 0', fontSize: '0.9rem' }}>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {currentPlan === p.id ? (
                <button disabled style={{ width: '100%' }}>Huidig plan</button>
              ) : (
                <a className="btn primary" href={`/api/billing/checkout?plan=${p.id}`} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                  Kies {p.name}
                </a>
              )}
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
          Prijzen excl. btw. Facturatie via Stripe (in dev: mock-activatie zonder betaling).
        </p>
      </div>
    </>
  );
}
