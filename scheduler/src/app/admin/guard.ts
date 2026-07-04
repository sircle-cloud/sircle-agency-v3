import { redirect } from 'next/navigation';
import { getSession } from '@/auth/session';
import { getRepository } from '@/config';
import type { Tenant, User } from '@/core/types';

/**
 * Beschermt admin-routes. Geen sessie → door naar /admin/login. Anders geeft het
 * de ingelogde host + tenant terug (altijd tenant-gescopet, §7 multi-tenant).
 */
export async function requireAdmin(): Promise<{ tenant: Tenant; host: User }> {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const repo = getRepository();
  const [tenant, host] = await Promise.all([
    repo.getTenantById(session.tenantId),
    repo.getUser(session.tenantId, session.userId),
  ]);
  if (!tenant || !host) redirect('/admin/login');
  return { tenant, host };
}
