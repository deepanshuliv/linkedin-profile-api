import { describe, it, expect } from 'vitest';
import { cookieHeaderToEntries, cookiesForBrowser } from '../src/linkedin/cookie-parse.js';

describe('cookie parsing', () => {
  it('splits a Cookie header into name/value pairs', () => {
    const entries = cookieHeaderToEntries('li_at=abc; JSESSIONID="ajax:123"; bcookie="v=2&uuid"');
    expect(entries).toEqual([
      { name: 'li_at', value: 'abc' },
      { name: 'JSESSIONID', value: '"ajax:123"' },
      { name: 'bcookie', value: '"v=2&uuid"' },
    ]);
  });

  it('maps cookies onto .linkedin.com for Chromium', () => {
    const cookies = cookiesForBrowser('li_at=abc; JSESSIONID="ajax:1"');
    expect(cookies[0]).toMatchObject({ name: 'li_at', domain: '.linkedin.com', url: 'https://www.linkedin.com/', secure: true, httpOnly: true });
    expect(cookies[1]).toMatchObject({ name: 'JSESSIONID', value: '"ajax:1"' });
  });
});
