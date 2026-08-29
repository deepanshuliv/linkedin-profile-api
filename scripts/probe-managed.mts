import { managedBrowserFetch, closeManagedBrowser } from '../src/linkedin/managed-browser.ts';

const res = await managedBrowserFetch('https://www.linkedin.com/voyager/api/me', {});
const body = await res.text();
console.log(
  JSON.stringify({
    status: res.status,
    ok: res.ok,
    url: res.url,
    location: res.headers.get('location'),
    bodyLen: body.length,
    bodyStart: body.slice(0, 240).replace(/\s+/g, ' '),
  })
);
await closeManagedBrowser();
