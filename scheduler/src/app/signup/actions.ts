'use server';

import { redirect } from 'next/navigation';
import { getOnboardingService } from '@/config';
import { setSession } from '@/auth/session';
import { hashPassword } from '@/auth/password';
import { DomainError } from '@/core/errors';

/** Self-service registratie van een nieuwe organisatie + eerste admin. */
export async function signupAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) {
    return { error: 'Wachtwoord moet minstens 8 tekens zijn.' };
  }

  let result;
  try {
    result = await getOnboardingService().registerTenant({
      orgName: String(formData.get('orgName') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      adminName: String(formData.get('adminName') ?? ''),
      adminEmail: String(formData.get('adminEmail') ?? ''),
      timezone: String(formData.get('timezone') ?? 'Europe/Amsterdam'),
      passwordHash: hashPassword(password),
    });
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    throw err;
  }

  await setSession(result.user.id, result.tenant.id);
  redirect('/admin');
}
