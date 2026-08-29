import { linkedinFetch } from './http.js';
import {
  ExpiredSessionError,
  ForbiddenError,
  EndpointGoneError,
  RateLimitedError,
  LinkedInServerError,
  BotChallengeError,
} from './errors.js';

interface RequestOptions {
  url: string;
  method?: string;
  params?: Record<string, string>;
  retries?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function buildUrl(url: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return url;
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (k === 'variables') {
      parts.push(`${k}=${v}`);
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return `${url}?${parts.join('&')}`;
}

function isLoginRedirect(location: string | null): boolean {
  if (!location) return false;
  return /\/login|\/checkpoint|\/authwall|\/uas\//i.test(location);
}

function isSameUrlRedirect(requestUrl: string, location: string | null): boolean {
  if (!location) return false;
  try {
    const a = new URL(requestUrl);
    const b = new URL(location, requestUrl);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch {
    return location === requestUrl;
  }
}

export async function voyagerRequest<T>(options: RequestOptions): Promise<T> {
  const maxRetries = options.retries ?? 0;
  let attempt = 0;

  while (attempt <= maxRetries) {
    const fullUrl = buildUrl(options.url, options.params);
    const response = await linkedinFetch(fullUrl, {
      method: options.method || 'GET',
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const location = response.headers.get('location');
    const clearSiteData = response.headers.get('clear-site-data');

    if (response.status === 401 || isLoginRedirect(location)) {
      throw new ExpiredSessionError(
        `LinkedIn session expired (HTTP ${response.status}${location ? ` → ${location}` : ''})`
      );
    }

    if (
      response.status >= 300 &&
      response.status < 400 &&
      (isSameUrlRedirect(fullUrl, location) || clearSiteData)
    ) {
      throw new BotChallengeError(
        `LinkedIn returned HTTP ${response.status} to the same URL. Refresh LINKEDIN_LI_AT and LINKEDIN_JSESSIONID from Chrome DevTools → Network → a voyager/api request (Cookie header).`
      );
    }

    if (response.status >= 300 && response.status < 400) {
      throw new ExpiredSessionError(
        `LinkedIn redirected (${response.status}) to ${location || 'unknown location'}`
      );
    }

    if (response.status === 403) {
      throw new ForbiddenError();
    }
    if (response.status === 410) {
      throw new EndpointGoneError();
    }
    if (response.status === 429) {
      if (attempt < maxRetries) {
        attempt++;
        await sleep(2000 * attempt);
        continue;
      }
      throw new RateLimitedError();
    }
    if (response.status >= 500) {
      if (attempt < maxRetries) {
        attempt++;
        await sleep(1000 * attempt);
        continue;
      }
      throw new LinkedInServerError(`Status: ${response.status}`);
    }

    const snippet = (await response.text()).slice(0, 180).replace(/\s+/g, ' ');
    throw new Error(`LinkedIn API responded with status ${response.status}${snippet ? `: ${snippet}` : ''}`);
  }

  throw new Error('Unreachable');
}
