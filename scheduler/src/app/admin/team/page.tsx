import Link from 'next/link';
import { requireAdmin } from '../guard';
import { getAdminService } from '@/config';
import AddTeamMemberForm from './AddTeamMemberForm';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const { tenant, host } = await requireAdmin();
  const team = await getAdminService().listTeam(tenant.id);

  return (
    <>
      <div className="brandbar">
        <div className="name">{tenant.name} — Team</div>
        <div className="sub">
          <Link href="/admin" style={{ color: 'var(--sage-green)' }}>← dashboard</Link>
        </div>
      </div>
      <div className="container">
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.1rem' }}>Teamleden (hosts)</h1>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.4rem', marginTop: '0.5rem' }}>
            {team.map((u) => (
              <li key={u.id} className="card" style={{ padding: '0.5rem 0.9rem' }}>
                <strong>{u.name}</strong> <span className="muted">— {u.email}</span>
                {u.id === host.id && <span className="tag">jij</span>}
              </li>
            ))}
          </ul>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Voeg teamleden toe om round-robin afspraaktypes te maken (afspraken
            worden dan eerlijk over hosts verdeeld).
          </p>
        </div>

        <div className="card">
          <h1 style={{ fontSize: '1.1rem' }}>Teamlid toevoegen</h1>
          <AddTeamMemberForm />
        </div>
      </div>
    </>
  );
}
