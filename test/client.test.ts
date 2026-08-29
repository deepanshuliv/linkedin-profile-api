import { describe, it, expect, vi, beforeEach } from 'vitest';
import { voyagerRequest } from '../src/linkedin/client.js';
import { linkedinFetch } from '../src/linkedin/http.js';
import { BotChallengeError, ExpiredSessionError } from '../src/linkedin/errors.js';

vi.mock('../src/linkedin/http.js', () => ({
  linkedinFetch: vi.fn(),
}));

function mockResponse(partial: {
  ok?: boolean;
  status: number;
  location?: string | null;
  clearSiteData?: string | null;
  body?: any;
}) {
  return {
    ok: partial.ok ?? false,
    status: partial.status,
    url: 'https://www.linkedin.com/voyager/api/me',
    headers: {
      get: (name: string) => {
        if (name === 'location') return partial.location ?? null;
        if (name === 'clear-site-data') return partial.clearSiteData ?? null;
        return null;
      },
    },
    json: async () => partial.body ?? {},
    text: async () => (typeof partial.body === 'string' ? partial.body : JSON.stringify(partial.body ?? {})),
  };
}

describe('Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw ExpiredSessionError on 401', async () => {
    vi.mocked(linkedinFetch).mockResolvedValueOnce(mockResponse({ status: 401 }) as any);

    await expect(voyagerRequest({ url: 'http://test' })).rejects.toThrow(ExpiredSessionError);
  });

  it('should treat 302 to login as expired session', async () => {
    vi.mocked(linkedinFetch).mockResolvedValueOnce(
      mockResponse({ status: 302, location: 'https://www.linkedin.com/uas/login' }) as any
    );

    await expect(voyagerRequest({ url: 'https://www.linkedin.com/voyager/api/me' })).rejects.toThrow(
      ExpiredSessionError
    );
  });

  it('should treat 302 to the same URL as a bot challenge, not 401', async () => {
    vi.mocked(linkedinFetch).mockResolvedValueOnce(
      mockResponse({
        status: 302,
        location: 'https://www.linkedin.com/voyager/api/me',
        clearSiteData: '"storage"',
      }) as any
    );

    await expect(voyagerRequest({ url: 'https://www.linkedin.com/voyager/api/me' })).rejects.toThrow(
      BotChallengeError
    );
  });

  it('should throw ForbiddenError on 403', async () => {
    vi.mocked(linkedinFetch).mockResolvedValueOnce(mockResponse({ status: 403 }) as any);

    await expect(voyagerRequest({ url: 'http://test' })).rejects.toThrow('LinkedIn forbidden (403)');
  });

  it('should throw EndpointGoneError on 410', async () => {
    vi.mocked(linkedinFetch).mockResolvedValueOnce(mockResponse({ status: 410 }) as any);

    await expect(voyagerRequest({ url: 'http://test' })).rejects.toThrow('Endpoint gone (410)');
  });

  it('should handle RateLimitedError on 429 with backoff', async () => {
    vi.mocked(linkedinFetch).mockResolvedValue(mockResponse({ status: 429 }) as any);

    const start = Date.now();
    await expect(voyagerRequest({ url: 'http://test', retries: 1 })).rejects.toThrow('Rate limited (429)');
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(2000);
  });

  it('should handle malformed JSON', async () => {
    vi.mocked(linkedinFetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      url: 'http://test',
      headers: { get: () => null },
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
      text: async () => '{',
    } as any);

    await expect(voyagerRequest({ url: 'http://test' })).rejects.toThrow('Unexpected token');
  });
});
