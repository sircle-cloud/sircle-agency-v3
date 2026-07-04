'use server';

import { redirect } from 'next/navigation';
import { getGuestService } from '@/config';
import { DomainError } from '@/core/errors';

/** Annuleren door de gast (plain form action). */
export async function guestCancelAction(formData: FormData): Promise<void> {
  const bookingId = String(formData.get('bookingId') ?? '');
  const token = String(formData.get('token') ?? '');
  let ok = false;
  try {
    await getGuestService().cancel(bookingId, token);
    ok = true;
  } catch (err) {
    if (!(err instanceof DomainError)) throw err;
  }
  redirect(`/manage/${bookingId}?token=${token}&status=${ok ? 'cancelled' : 'error'}`);
}

/** Verzetten door de gast (via useActionState → foutmelding terug). */
export async function guestRescheduleAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const bookingId = String(formData.get('bookingId') ?? '');
  const token = String(formData.get('token') ?? '');
  const newStartUtc = String(formData.get('newStartUtc') ?? '');
  try {
    await getGuestService().reschedule(bookingId, token, newStartUtc);
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    throw err;
  }
  redirect(`/manage/${bookingId}?token=${token}&status=rescheduled`);
}
