import { describe, it, expect } from 'vitest';
import { parseLinkedInProfileUrl } from '../src/linkedin/url.js';

describe('parseLinkedInProfileUrl', () => {
  it('extracts the public identifier from a canonical profile URL', () => {
    expect(parseLinkedInProfileUrl('https://www.linkedin.com/in/reidhoffman')).toBe('reidhoffman');
  });

  it('allows trailing slash, query string, and country subdomain', () => {
    expect(parseLinkedInProfileUrl('https://in.linkedin.com/in/reidhoffman/?trk=x')).toBe('reidhoffman');
  });

  it('rejects non-profile URLs', () => {
    expect(() => parseLinkedInProfileUrl('https://www.linkedin.com/company/linkedin')).toThrow(
      'Invalid LinkedIn URL'
    );
  });
});
