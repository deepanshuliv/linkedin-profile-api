import dotenv from 'dotenv';
dotenv.config();

export interface LinkedInAuth {
  li_at: string;
  jsessionid: string;
  csrf_token: string;
  cookie_header: string;
}

function stripQuotes(value: string): string {
  return value.replace(/^"+|"+$/g, '');
}

function quoteJsessionId(value: string): string {
  const inner = stripQuotes(value);
  return `"${inner}"`;
}

function csrfFromJsessionId(value: string): string {
  return stripQuotes(value);
}

function csrfFromCookieHeader(cookieHeader: string): string | null {
  const match = cookieHeader.match(/JSESSIONID=([^;]+)/i);
  if (!match) return null;
  return csrfFromJsessionId(match[1].trim());
}

export function getAuth(): LinkedInAuth {
  const cookieOverride = process.env.LINKEDIN_COOKIE?.trim();
  const li_at = process.env.LINKEDIN_LI_AT;
  const jsessionid = process.env.LINKEDIN_JSESSIONID;
  let csrf_token = process.env.LINKEDIN_CSRF_TOKEN;

  if (cookieOverride) {
    const csrf = csrf_token ? stripQuotes(csrf_token) : csrfFromCookieHeader(cookieOverride);
    if (!csrf) {
      throw new Error('LINKEDIN_COOKIE is set but JSESSIONID is missing from it (needed for csrf-token)');
    }
    return {
      li_at: li_at || '',
      jsessionid: quoteJsessionId(csrf),
      csrf_token: csrf,
      cookie_header: cookieOverride,
    };
  }

  if (!li_at || !jsessionid) {
    throw new Error('LINKEDIN_LI_AT and LINKEDIN_JSESSIONID must be set in environment variables');
  }

  if (!csrf_token) {
    csrf_token = csrfFromJsessionId(jsessionid);
  } else {
    csrf_token = stripQuotes(csrf_token);
  }

  return {
    li_at,
    jsessionid: quoteJsessionId(jsessionid),
    csrf_token,
    cookie_header: `li_at=${li_at}; JSESSIONID=${quoteJsessionId(jsessionid)}`,
  };
}

export function hasCookieAuth(): boolean {
  return Boolean(process.env.LINKEDIN_COOKIE?.trim() || (process.env.LINKEDIN_LI_AT && process.env.LINKEDIN_JSESSIONID));
}
