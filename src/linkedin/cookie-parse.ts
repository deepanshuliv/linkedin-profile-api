export interface CookieEntry {
  name: string;
  value: string;
}

export function cookieHeaderToEntries(header: string): CookieEntry[] {
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=');
      if (eq === -1) return { name: part, value: '' };
      return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
    });
}

export function cookiesForBrowser(cookieHeader: string): Array<{
  name: string;
  value: string;
  url: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
}> {
  return cookieHeaderToEntries(cookieHeader).map((c) => ({
    name: c.name,
    value: c.value,
    url: 'https://www.linkedin.com/',
    domain: '.linkedin.com',
    path: '/',
    httpOnly: c.name === 'li_at' || c.name === 'bscookie' || c.name === 'JSESSIONID',
    secure: true,
  }));
}
