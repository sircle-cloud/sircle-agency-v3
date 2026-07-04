'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '../actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {});
  return (
    <>
      <div className="brandbar">
        <div className="name">SIRCLE Planner — Admin</div>
        <div className="sub">inloggen</div>
      </div>
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="card">
          <h1>Inloggen</h1>
          <form action={formAction}>
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
            <label htmlFor="password">Wachtwoord</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            {state?.error && <div className="notice error">{state.error}</div>}
            <button className="primary" type="submit" disabled={pending} style={{ marginTop: '1rem', width: '100%' }}>
              {pending ? 'Bezig…' : 'Inloggen'}
            </button>
          </form>
          <p className="muted" style={{ marginTop: '1rem' }}>
            Demo-login: <code>koen@sircle.example</code> / <code>demo1234</code>
            <br />
            Nog geen account? <Link href="/signup">Organisatie aanmaken</Link>
          </p>
        </div>
      </div>
    </>
  );
}
