'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { signupAction } from './actions';

function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, {});
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <>
      <div className="brandbar">
        <div className="name">SIRCLE Planner</div>
        <div className="sub">nieuwe organisatie aanmaken</div>
      </div>
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card">
          <h1>Aan de slag</h1>
          <p className="muted">Maak een gratis account en krijg meteen een werkende boekingspagina.</p>
          <form action={formAction}>
            <label htmlFor="orgName">Organisatienaam</label>
            <input
              id="orgName"
              name="orgName"
              required
              onChange={(e) => {
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />

            <label htmlFor="slug">URL-naam</label>
            <input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="mijn-praktijk"
              required
            />
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              Je boekingspagina: /{slug || 'mijn-praktijk'}/kennismaking
            </span>

            <label htmlFor="adminName">Jouw naam</label>
            <input id="adminName" name="adminName" required />

            <label htmlFor="adminEmail">E-mail</label>
            <input id="adminEmail" name="adminEmail" type="email" autoComplete="username" required />

            <label htmlFor="password">Wachtwoord (min. 8 tekens)</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />

            <input type="hidden" name="timezone" value="Europe/Amsterdam" />

            {state?.error && <div className="notice error">{state.error}</div>}
            <button className="primary" type="submit" disabled={pending} style={{ marginTop: '1rem', width: '100%' }}>
              {pending ? 'Aanmaken…' : 'Organisatie aanmaken'}
            </button>
          </form>
          <p className="muted" style={{ marginTop: '1rem' }}>
            Al een account? <Link href="/admin/login">Inloggen</Link>
          </p>
        </div>
      </div>
    </>
  );
}
