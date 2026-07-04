import Link from 'next/link';
import { requireAdmin } from '../guard';
import { getAdminService } from '@/config';
import AvailabilityForm from './AvailabilityForm';

export const dynamic = 'force-dynamic';

export default async function AvailabilityPage() {
  const { tenant, host } = await requireAdmin();
  const rules = await getAdminService().getAvailability(tenant.id, host.id);

  return (
    <>
      <div className="brandbar">
        <div className="name">{tenant.name} — Beschikbaarheid</div>
        <div className="sub">
          <Link href="/admin" style={{ color: 'var(--sage-green)' }}>← dashboard</Link>
        </div>
      </div>
      <div className="container">
        <div className="card">
          <h1 style={{ fontSize: '1.1rem' }}>Wekelijkse werktijden</h1>
          <AvailabilityForm rules={rules} timezone={tenant.timezone} />
        </div>
      </div>
    </>
  );
}
