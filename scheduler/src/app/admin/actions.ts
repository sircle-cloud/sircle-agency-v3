'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getRepository, getAdminService } from '@/config';
import { getSession, setSession, clearSession } from '@/auth/session';
import { verifyPassword, hashPassword } from '@/auth/password';
import { DomainError } from '@/core/errors';
import type { EventType } from '@/core/types';

/** Login: e-mail + wachtwoord → sessie-cookie. */
export async function loginAction(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const user = await getRepository().getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: 'Onjuiste e-mail of wachtwoord.' };
  }
  await setSession(user.id, user.tenantId);
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/admin/login');
}

async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  return session;
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const bookingId = String(formData.get('bookingId') ?? '');
  await getAdminService().cancelBooking(session.tenantId, bookingId);
  revalidatePath('/admin');
}

export async function saveEventTypeAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireSession();
  const num = (k: string, d = 0) => Number(formData.get(k) ?? d);
  // Round-robin host-pool (checkboxes). Leeg = single host (de ingelogde admin).
  const hostUserIds = formData.getAll('hostUserIds').map(String).filter(Boolean);
  try {
    await getAdminService().saveEventType({
      id: (formData.get('id') as string) || undefined,
      tenantId: session.tenantId,
      hostUserId: session.userId,
      hostUserIds,
      slug: String(formData.get('slug') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim(),
      description: String(formData.get('description') ?? ''),
      durationMin: num('durationMin', 30),
      slotGranularityMin: num('slotGranularityMin') || undefined,
      bufferBeforeMin: num('bufferBeforeMin'),
      bufferAfterMin: num('bufferAfterMin'),
      minNoticeMin: num('minNoticeMin'),
      locationType: (String(formData.get('locationType') ?? 'video') as EventType['locationType']),
    });
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    throw err;
  }
  revalidatePath('/admin/event-types');
  redirect('/admin/event-types');
}

export async function deleteEventTypeAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  await getAdminService().deleteEventType(session.tenantId, String(formData.get('id') ?? ''));
  revalidatePath('/admin/event-types');
}

export async function addTeamMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireSession();
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) return { error: 'Wachtwoord moet minstens 8 tekens zijn.' };
  try {
    await getAdminService().addTeamMember({
      tenantId: session.tenantId,
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      passwordHash: hashPassword(password),
    });
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    throw err;
  }
  revalidatePath('/admin/team');
  return { ok: true };
}

export async function saveAvailabilityAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireSession();
  const timezone = String(formData.get('timezone') ?? 'Europe/Amsterdam');
  const slots: { weekday: number; start: string; end: string }[] = [];
  // Velden komen als start_<weekday> / end_<weekday>; leeg = die dag niet beschikbaar.
  for (let weekday = 1; weekday <= 7; weekday++) {
    const start = String(formData.get(`start_${weekday}`) ?? '').trim();
    const end = String(formData.get(`end_${weekday}`) ?? '').trim();
    if (start && end) slots.push({ weekday, start, end });
  }
  try {
    await getAdminService().saveAvailability(session.tenantId, session.userId, timezone, slots);
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    throw err;
  }
  revalidatePath('/admin/availability');
  return { ok: true };
}
