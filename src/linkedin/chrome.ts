import puppeteer, { Browser, Page } from 'puppeteer-core';
import type { LinkedInHttpResponse } from './types.js';
import { inPageVoyagerFetch } from './in-page-fetch.js';

const DEFAULT_CDP = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';

let browser: Browser | null = null;
let page: Page | null = null;
let cdpCheckedAt = 0;
let cdpAvailable = false;

export function getCdpUrl(): string {
  return DEFAULT_CDP.replace(/\/$/, '');
}

export async function isChromeCdpAvailable(): Promise<boolean> {
  const now = Date.now();
  if (now - cdpCheckedAt < 2000) return cdpAvailable;
  cdpCheckedAt = now;
  try {
    const res = await fetch(`${getCdpUrl()}/json/version`, {
      signal: AbortSignal.timeout(800),
    });
    cdpAvailable = res.ok;
  } catch {
    cdpAvailable = false;
  }
  return cdpAvailable;
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.connect({
    browserURL: getCdpUrl(),
    defaultViewport: null,
  });
  browser.on('disconnected', () => {
    browser = null;
    page = null;
    cdpAvailable = false;
  });
  return browser;
}

async function getLinkedInPage(b: Browser): Promise<Page> {
  if (page && !page.isClosed()) {
    return page;
  }

  const pages = await b.pages();
  const existing = pages.find((p) => {
    const url = p.url();
    return url.includes('linkedin.com') && !url.startsWith('chrome-extension://');
  });

  if (existing) {
    page = existing;
    return page;
  }

  page = await b.newPage();
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  return page;
}

export async function chromeFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string> }
): Promise<LinkedInHttpResponse> {
  const b = await getBrowser();
  const p = await getLinkedInPage(b);
  return inPageVoyagerFetch(p, url, options);
}

export async function disconnectChrome(): Promise<void> {
  if (browser) {
    try {
      browser.disconnect();
    } catch {
      // ignore
    }
    browser = null;
    page = null;
  }
}
