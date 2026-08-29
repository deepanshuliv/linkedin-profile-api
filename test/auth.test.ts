import { describe, it, expect, afterEach } from 'vitest';
import { getAuth } from '../src/linkedin/auth.js';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env.LINKEDIN_LI_AT = ORIGINAL.LINKEDIN_LI_AT;
  process.env.LINKEDIN_JSESSIONID = ORIGINAL.LINKEDIN_JSESSIONID;
  process.env.LINKEDIN_CSRF_TOKEN = ORIGINAL.LINKEDIN_CSRF_TOKEN;
  process.env.LINKEDIN_COOKIE = ORIGINAL.LINKEDIN_COOKIE;
});

describe('auth cookie construction', () => {
  it('quotes JSESSIONID in the Cookie header and strips quotes for csrf-token', () => {
    process.env.LINKEDIN_LI_AT = 'abc';
    process.env.LINKEDIN_JSESSIONID = 'ajax:123';
    delete process.env.LINKEDIN_CSRF_TOKEN;
    delete process.env.LINKEDIN_COOKIE;

    const auth = getAuth();
    expect(auth.csrf_token).toBe('ajax:123');
    expect(auth.cookie_header).toBe('li_at=abc; JSESSIONID="ajax:123"');
  });

  it('does not double-quote an already quoted JSESSIONID from .env', () => {
    process.env.LINKEDIN_LI_AT = 'abc';
    process.env.LINKEDIN_JSESSIONID = '"ajax:123"';
    delete process.env.LINKEDIN_CSRF_TOKEN;
    delete process.env.LINKEDIN_COOKIE;

    const auth = getAuth();
    expect(auth.csrf_token).toBe('ajax:123');
    expect(auth.cookie_header).toBe('li_at=abc; JSESSIONID="ajax:123"');
  });

  it('uses LINKEDIN_COOKIE as the full browser Cookie header when set', () => {
    process.env.LINKEDIN_COOKIE = 'li_at=xyz; JSESSIONID="ajax:999"; bcookie="v=2&uuid"';
    delete process.env.LINKEDIN_CSRF_TOKEN;

    const auth = getAuth();
    expect(auth.csrf_token).toBe('ajax:999');
    expect(auth.cookie_header).toContain('bcookie=');
  });
});
