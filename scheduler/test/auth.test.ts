import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/auth/password';

describe('wachtwoord-hashing (scrypt)', () => {
  it('verifieert het juiste wachtwoord en wijst het foute af', () => {
    const hash = hashPassword('demo1234');
    expect(verifyPassword('demo1234', hash)).toBe(true);
    expect(verifyPassword('fout', hash)).toBe(false);
    expect(verifyPassword('demo1234', undefined)).toBe(false);
  });

  it('gebruikt een random salt (twee hashes verschillen)', () => {
    expect(hashPassword('zelfde')).not.toBe(hashPassword('zelfde'));
  });
});
