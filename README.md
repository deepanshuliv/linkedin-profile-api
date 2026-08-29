# LinkedIn Profile API

Hosted API for the Tross hiring challenge: pass a LinkedIn profile URL, get structured JSON (name, headline, location, about, experience, education, skills, certifications, languages, profile image).

This implementation **only calls LinkedIn Voyager HTTP endpoints**. There is no headless browser, Puppeteer, or Playwright.

Credentials stay in backend environment variables and are never committed.

## Setup

**Requirements:** Node.js 22+, a LinkedIn account you control.

1. Clone and install:

```bash
git clone https://github.com/deepanshuliv/linkedin-profile-api.git
cd linkedin-profile-api
npm install
cp .env.example .env
```

2. Capture session cookies from a **Voyager XHR**, not from guessing cookie names. In Chrome (logged in): DevTools → Network → filter `voyager` → open a profile → click a request to `/voyager/api/` → copy `li_at` and `JSESSIONID` (`ajax:…`) into `.env`:

```bash
LINKEDIN_LI_AT=your_li_at_value
LINKEDIN_JSESSIONID=ajax:your_jsession_value
```

Optional: paste the full request `Cookie` header as `LINKEDIN_COOKIE` instead.

3. Run:

```bash
npm test
npm run dev
```

Server: `http://localhost:3000`

**Docker / public HTTPS:** `docker compose up --build`, or import this repo on [Render](https://render.com) (`render.yaml`). Set `LINKEDIN_LI_AT` and `LINKEDIN_JSESSIONID` as **secret env vars** on the host, not in git.

## API documentation

### `GET /health`

Liveness. `{ "ok": true, "cookiesConfigured": true }`

### `POST /api/linkedin/profile`

```http
POST /api/linkedin/profile
Content-Type: application/json

{ "url": "https://www.linkedin.com/in/reidhoffman" }
```

### `GET /api/linkedin/profile?url=`

```http
GET /api/linkedin/profile?url=https://www.linkedin.com/in/reidhoffman
```

**Success (200)** — fields required by the brief:

```json
{
  "url": "https://www.linkedin.com/in/reidhoffman",
  "publicIdentifier": "reidhoffman",
  "profileId": "...",
  "entityUrn": "urn:li:fsd_profile:...",
  "name": { "first": "...", "last": "...", "full": "..." },
  "headline": "...",
  "location": { "name": "...", "country": "...", "countryCode": "...", "geoUrn": "..." },
  "about": "...",
  "profileImage": { "url": "https://media.licdn.com/...", "width": 400, "height": 400 },
  "experience": [{ "title": "...", "companyName": "...", "current": true, "start": { "year": 2020, "month": 1, "day": null }, "end": null }],
  "education": [{ "school": "...", "degree": "...", "fieldOfStudy": "...", "dates": { "start": {}, "end": {} } }],
  "skills": [{ "name": "...", "endorsementCount": 0 }],
  "certifications": [{ "name": "...", "issuer": "..." }],
  "languages": [{ "name": "...", "proficiency": "..." }],
  "meta": { "source": "dash", "partial": false, "warnings": [] }
}
```

`profileImage` is `null` when LinkedIn omits a photo.

| Status | When |
|---|---|
| 400 | Missing or non-`/in/` URL |
| 401 | Session expired — refresh cookies from a voyager/api request |
| 403 | LinkedIn rejected the request (often stale cookies or edge 302) |
| 404 | Profile not found or not visible to the session |
| 429 | Rate limited |
| 502 | LinkedIn 5xx |

## Approach

LinkedIn’s profile page is not served by the public Profile REST API. The site loads data from internal **Voyager** endpoints:

- `GET /voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity={slug}&decorationId=…`
- Fallback: `GET /voyager/api/graphql?variables=(vanityName:…)&queryName=voyagerIdentityDashProfiles`

These use Rest.li query syntax and the `csrf-token` header (the `ajax:…` value from `JSESSIONID`). Authentication is the logged-in member’s `li_at` cookie, which the brief allows as backend credentials.

This service:

1. Parses `/in/{slug}` from the input URL.
2. Sends a GET to the dash profiles endpoint with session cookies + CSRF + `x-restli-protocol-version: 2.0.0`.
3. Falls back to GraphQL if dash fails for a non-auth reason.
4. Indexes Voyager’s `included` graph by `entityUrn` and maps name, headline, location, about, experience, education, skills, certifications, languages, and profile image.

HTTP is issued through a Chrome-like TLS fingerprint (`impit`, Chrome 151) so the request looks like a normal web client. **No browser is launched.** Endpoint IDs live in `src/linkedin/endpoints.ts` and can be updated from DevTools when LinkedIn ships a new `decorationId` / `queryName`.

## Known limitations

- **Unofficial API.** Voyager is undocumented. Hashes in `endpoints.ts` can go stale (400 / empty body).
- **Session cookies expire.** There is no OAuth refresh. Recapture `li_at` / `JSESSIONID` from Network when probes fail.
- **Edge 302.** LinkedIn sometimes returns HTTP 302 to the same Voyager URL when the session is stale or the client fingerprint is rejected. Treat as “refresh cookies,” not a code path that needs a browser.
- **Visibility** is whatever the backend account can see.
- **`meta.partial`** is true when core identity exists but a section was missing from the payload.
- **ToS.** Automated Voyager access may violate LinkedIn terms; this is a hiring exercise using the operator’s own account.
- **Rate limits.** Back off on 429.
