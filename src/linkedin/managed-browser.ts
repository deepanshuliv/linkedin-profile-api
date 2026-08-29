import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { getAuth, hasCookieAuth } from './auth.js';
import { cookiesForBrowser } from './cookie-parse.js';
import { navigateVoyagerFetch } from './in-page-fetch.js';
import type { LinkedInHttpResponse } from './types.js';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((p): p is string => Boolean(p));

function findChrome(): string {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'No Chrome/Chromium binary found. Deploy with the provided Dockerfile, or set CHROME_PATH / PUPPETEER_EXECUTABLE_PATH.'
    );
  }
  return found;
}

function profileDir(): string {
  const dir = resolve(process.env.LINKEDIN_BROWSER_PROFILE || './data/chrome-profile');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function headless(): boolean | 'shell' {
  const raw = (process.env.LINKEDIN_BROWSER_HEADLESS ?? 'true').toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

let browser: Browser | null = null;
let page: Page | null = null;
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function stealth(p: Page): Promise<void> {
  await p.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
}

async function injectCookies(p: Page): Promise<void> {
  if (!hasCookieAuth()) return;
  const existing = await p.cookies('https://www.linkedin.com');
  for (const cookie of existing) {
    if (cookie.name === 'JSESSIONID' || cookie.name === 'li_at') {
      await p.deleteCookie({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
      });
    }
  }
  const auth = getAuth();
  const cookies = cookiesForBrowser(auth.cookie_header);
  if (cookies.length === 0) return;
  await p.setCookie(...cookies);
}

async function ensurePage(): Promise<Page> {
  if (page && !page.isClosed() && browser?.connected) {
    return page;
  }

  const executablePath = findChrome();
  const userDataDir = profileDir();
  const proxy = process.env.LINKEDIN_PROXY_URL?.trim();

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
    '--disable-gpu',
  ];
  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }

  console.log(`Launching Chromium for LinkedIn (${executablePath}, profile ${userDataDir})`);

  browser = await puppeteer.launch({
    executablePath,
    userDataDir,
    headless: headless(),
    args,
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  browser.on('disconnected', () => {
    browser = null;
    page = null;
  });

  const pages = await browser.pages();
  page = pages[0] || (await browser.newPage());
  await stealth(page);
  try {
    await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch (err: any) {
    console.warn(`Guest LinkedIn navigation: ${err.message}`);
  }
  await injectCookies(page);
  const names = (await page.cookies('https://www.linkedin.com')).map((c) => c.name);
  console.log(`LinkedIn cookies in Chromium: ${names.join(', ') || '(none)'}`);
  return page;
}

export async function isManagedBrowserReady(): Promise<boolean> {
  try {
    findChrome();
    return hasCookieAuth();
  } catch {
    return false;
  }
}

export async function managedBrowserFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string> }
): Promise<LinkedInHttpResponse> {
  return enqueue(async () => {
    const p = await ensurePage();
    return navigateVoyagerFetch(p, url, options);
  });
}

export async function closeManagedBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // ignore
    }
    browser = null;
    page = null;
  }
}

export function getManagedBrowserInfo(): { executablePath: string; profileDir: string } {
  return { executablePath: findChrome(), profileDir: profileDir() };
}
