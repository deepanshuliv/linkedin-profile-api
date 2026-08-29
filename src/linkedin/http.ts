import { getAuth, hasCookieAuth } from './auth.js';
import { chromeFetch, isChromeCdpAvailable } from './chrome.js';
import { managedBrowserFetch, isManagedBrowserReady } from './managed-browser.js';
import type { LinkedInHttpResponse } from './types.js';

export type LinkedInTransport = 'cdp' | 'managed-chrome';

export function voyagerHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'x-restli-protocol-version': '2.0.0',
    accept: 'application/vnd.linkedin.normalized+json+2.1',
    'accept-language': 'en-US,en;q=0.9',
    'x-li-lang': 'en_US',
    referer: extra.referer || 'https://www.linkedin.com/feed/',
    origin: 'https://www.linkedin.com',
    'x-li-track': JSON.stringify({
      clientVersion: '1.13.42372',
      mpVersion: '1.13.42372',
      osName: 'web',
      timezoneOffset: 5.5,
      timezone: 'Asia/Kolkata',
      deviceFormFactor: 'DESKTOP',
      mpName: 'voyager-web',
      displayDensity: 1,
      displayWidth: 1512,
      displayHeight: 982,
    }),
    ...extra,
  };

  return headers;
}

export async function resolveTransport(): Promise<LinkedInTransport> {
  if (await isChromeCdpAvailable()) return 'cdp';
  if (await isManagedBrowserReady()) return 'managed-chrome';
  throw new Error(
    'No LinkedIn transport. Set LINKEDIN_LI_AT + LINKEDIN_JSESSIONID (server Chromium) or run `npm run chrome:debug` (local Chrome).'
  );
}

export async function linkedinFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string> } = {}
): Promise<LinkedInHttpResponse> {
  const method = options.method || 'GET';
  const headers = voyagerHeaders(options.headers || {});
  delete headers.cookie;
  delete headers['csrf-token'];

  const transport = await resolveTransport();
  if (transport === 'cdp') {
    return chromeFetch(url, { method, headers });
  }

  if (!hasCookieAuth()) {
    getAuth();
  }
  return managedBrowserFetch(url, { method, headers });
}
