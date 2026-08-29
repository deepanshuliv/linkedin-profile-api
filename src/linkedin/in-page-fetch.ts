import type { Page } from 'puppeteer-core';
import type { LinkedInHttpResponse } from './types.js';
import { getAuth, hasCookieAuth } from './auth.js';

function mapEvaluateResult(result: {
  status: number;
  ok: boolean;
  url: string;
  text: string;
  headerPairs: [string, string][];
}): LinkedInHttpResponse {
  const headerMap = new Map(result.headerPairs.map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: result.ok,
    status: result.status,
    url: result.url,
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
    text: async () => result.text,
    json: async () => JSON.parse(result.text),
  };
}

function resolveCsrf(pageCookies: Array<{ name: string; value: string }>, headerCsrf?: string): string {
  if (headerCsrf) return headerCsrf;
  const jsession = pageCookies.find((c) => c.name === 'JSESSIONID')?.value;
  if (jsession) return jsession.replace(/^"+|"+$/g, '');
  if (hasCookieAuth()) return getAuth().csrf_token;
  throw new Error('Chromium has no LinkedIn JSESSIONID. Provide session cookies and restart.');
}

/** Same-origin fetch inside an existing LinkedIn tab (does not navigate it away). */
export async function inPageVoyagerFetch(
  page: Page,
  url: string,
  options: { method?: string; headers?: Record<string, string> }
): Promise<LinkedInHttpResponse> {
  const currentUrl = page.url();
  if (!currentUrl.includes('linkedin.com')) {
    await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  const csrf = resolveCsrf(await page.cookies('https://www.linkedin.com'), options.headers?.['csrf-token']);
  const headers: Record<string, string> = { ...(options.headers || {}) };
  delete headers.cookie;
  delete headers.Cookie;
  delete headers['user-agent'];
  delete headers['User-Agent'];
  headers['csrf-token'] = csrf;

  const result = await page.evaluate(
    async (payload: { url: string; method: string; headers: Record<string, string> }) => {
      const res = await fetch(payload.url, {
        method: payload.method,
        credentials: 'include',
        headers: payload.headers,
      });
      const text = await res.text();
      const headerPairs: [string, string][] = [];
      res.headers.forEach((value, key) => {
        headerPairs.push([key, value]);
      });
      return { status: res.status, ok: res.ok, url: res.url, text, headerPairs };
    },
    { url, method: options.method || 'GET', headers }
  );

  return mapEvaluateResult(result);
}

/** Dedicated Chromium: navigate to the Voyager URL so TLS/cookies are Chrome's, not Node's. */
export async function navigateVoyagerFetch(
  page: Page,
  url: string,
  options: { method?: string; headers?: Record<string, string> }
): Promise<LinkedInHttpResponse> {
  const method = options.method || 'GET';
  if (method !== 'GET') {
    throw new Error(`Managed Chrome transport only supports GET (got ${method})`);
  }

  const csrf = resolveCsrf(await page.cookies('https://www.linkedin.com'), options.headers?.['csrf-token']);
  await page.setExtraHTTPHeaders({
    'csrf-token': csrf,
    'x-restli-protocol-version': '2.0.0',
    accept: 'application/vnd.linkedin.normalized+json+2.1',
    'accept-language': 'en-US,en;q=0.9',
    'x-li-lang': 'en_US',
  });

  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (err: any) {
    const message = String(err?.message || err);
    if (
      message.includes('TOO_MANY_REDIRECTS') ||
      message.includes('ERR_FAILED') ||
      message.includes('Navigation timeout')
    ) {
      return {
        ok: false,
        status: 302,
        url,
        headers: {
          get: (name: string) => {
            if (name.toLowerCase() === 'location') return url;
            if (name.toLowerCase() === 'clear-site-data') return '"storage"';
            return null;
          },
        },
        text: async () => '',
        json: async () => ({}),
      };
    }
    throw err;
  }
  if (!response) {
    throw new Error(`No HTTP response from ${url}`);
  }

  const text = await response.text();
  const raw = response.headers();
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    lower[k.toLowerCase()] = v;
  }

  return {
    ok: response.ok(),
    status: response.status(),
    url: response.url(),
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}
