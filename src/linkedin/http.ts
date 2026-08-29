import { Impit } from 'impit';
import { getAuth } from './auth.js';
import type { LinkedInHttpResponse } from './types.js';

const impit = new Impit({
  browser: 'chrome151',
  followRedirects: false,
});

export function voyagerHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const auth = getAuth();
  return {
    cookie: auth.cookie_header,
    'csrf-token': auth.csrf_token,
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
}

export async function linkedinFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string> } = {}
): Promise<LinkedInHttpResponse> {
  const method = (options.method || 'GET') as 'GET';
  const headers = voyagerHeaders(options.headers || {});
  delete headers['user-agent'];
  delete headers['User-Agent'];

  const response = await impit.fetch(url, {
    method,
    headers,
    redirect: 'manual',
  });

  const headerBag = response.headers;
  const bodyText = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    headers: {
      get: (name: string) => headerBag.get(name),
    },
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
  };
}
