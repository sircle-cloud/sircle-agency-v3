'use client';

import { useActionState } from 'react';
import { addTeamMemberAction } from '../actions';

export default function AddTeamMemberForm() {
  const [state, formAction, pending] = useActionState(addTeamMemberAction, {});
  return (
    <form action={formAction}>
      <label htmlFor="name">Naam</label>
      <input id="name" name="name" required />
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" required />
      <label htmlFor="password">Wachtwoord (min. 8 tekens)</label>
      <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
      {state?.error && <div className="notice error">{state.error}</div>}
      {state?.ok && <div className="notice success">Teamlid toegevoegd.</div>}
      <button className="primary" type="submit" disabled={pending} style={{ marginTop: '1rem' }}>
        {pending ? 'Toevoegen…' : 'Teamlid toevoegen'}
      </button>
    </form>
  );
}
