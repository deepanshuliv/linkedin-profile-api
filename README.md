# LinkedIn Profile API

Hosted API for the Tross hiring challenge: pass a LinkedIn profile URL, get structured JSON (name, headline, location, about, experience, education, skills, certifications, languages, profile image).

Credentials stay in backend environment variables. They are never committed.

## Setup

**Requirements:** Node.js 22+, a LinkedIn account you control.

1. Clone the repo and install:

```bash
git clone https://github.com/deepanshuliv/linkedin-profile-api.git
cd linkedin-profile-api
npm install
cp .env.example .env
```

2. Put your LinkedIn session in `.env` (backend only). In Chrome, open LinkedIn while logged in → DevTools → Network → click a `voyager/api` request → copy `li_at` and `JSESSIONID` (value looks like `ajax:…`):

```bash
LINKEDIN_LI_AT=your_li_at_value
LINKEDIN_JSESSIONID=ajax:your_jsession_value
```

3. Run locally:

```bash
npm test
npm run dev
```

The server listens on `http://localhost:3000`.

**Docker (same process used for public HTTPS):**

```bash
docker compose up --build
```

Set the same variables in `.env`. Chromium inside the container calls LinkedIn's Voyager APIs using that session. Persist `/app/data/chrome-profile` so the session survives restarts.

**Public HTTPS:** import this repo on [Render](https://render.com) (see `render.yaml`) or any Docker host. Set `LINKEDIN_LI_AT` and `LINKEDIN_JSESSIONID` as **secret env vars** in the host dashboard — not in git. Render will serve the service over HTTPS.

## API documentation

Base URL (local): `http://localhost:3000`  
Base URL (hosted): your Render/HTTPS URL

### `GET /health`

Liveness check.

### `POST /api/linkedin/profile`

**Request**

```http
POST /api/linkedin/profile
Content-Type: application/json

{ "url": "https://www.linkedin.com/in/reidhoffman" }
```

### `GET /api/linkedin/profile?url=`

Same handler, convenient for a browser:

```http
GET /api/linkedin/profile?url=https://www.linkedin.com/in/reidhoffman
```

**Success (200)** — schema is ours; fields map to the challenge list:

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
  "experience": [
    {
      "title": "...",
      "companyName": "...",
      "companyLogoUrl": "...",
      "employmentType": "...",
      "location": "...",
      "description": "...",
      "current": true,
      "start": { "year": 2020, "month": 1, "day": null },
      "end": null
    }
  ],
  "education": [{ "school": "...", "degree": "...", "fieldOfStudy": "...", "dates": { "start": {}, "end": {} } }],
  "skills": [{ "name": "...", "endorsementCount": 0 }],
  "certifications": [{ "name": "...", "issuer": "...", "credentialId": null, "credentialUrl": null }],
  "languages": [{ "name": "...", "proficiency": "..." }],
  "meta": { "source": "dash", "partial": false, "warnings": [] }
}
```

`profileImage` is `null` when LinkedIn does not return a photo.

**Errors**

| Status | When |
|---|---|
| 400 | Missing or non-`/in/` URL |
| 401 | Backend LinkedIn session expired — refresh env cookies and restart |
| 403 | LinkedIn blocked the request |
| 404 | Profile not found or not visible to the session |
| 429 | Rate limited |
| 502 | LinkedIn 5xx |

## Approach

LinkedIn's site does not use the public Marketing/Profile REST APIs for the profile page. The browser calls internal **Voyager** endpoints (`/voyager/api/...`) with Rest.li query params (`q=memberIdentity`, `decorationId`, GraphQL `queryName` / `variables`).

This service reverse-engineers those calls:

1. Parse the public identifier from `/in/{slug}`.
2. Authenticate as the operator using **session cookies** (`li_at` + `JSESSIONID` CSRF) stored only in the backend environment — as the brief allows.
3. Request `identity/dash/profiles` (decoration `WebTopCardCore`) first, then fall back to Voyager GraphQL (`voyagerIdentityDashProfiles`) if the dash payload is incomplete or gone.
4. Normalize the `included` graph (`entityUrn` index) and map it onto the JSON schema above.

LinkedIn's edge often rejects raw Node TLS (HTTP 302 to the same URL). On a server the process therefore drives **Chromium**, injects the same cookies, and performs the Voyager request inside that browser so the TLS fingerprint matches a real client. The captured endpoint IDs live in `src/linkedin/endpoints.ts` and can be updated from Chrome DevTools when LinkedIn ships a new decoration/query hash.

## Known limitations

- **Unofficial API.** Voyager is undocumented. `decorationId` and GraphQL hashes change; a 400/empty body means those constants in `endpoints.ts` need a refresh from a live profile page.
- **Session cookies expire.** `li_at` is not an OAuth refresh token. When LinkedIn invalidates the session, update the host env vars and restart. Automated use can shorten cookie lifetime.
- **Visibility.** The payload is whatever the backend account is allowed to see (logged-in member view), not a guaranteed full public scrape of every profile.
- **Partial responses.** `meta.partial` is `true` when name/headline exist but experience, education, or skills are missing from the Voyager payload.
- **Infrastructure.** Chromium needs ~1.5 GB RAM. Datacenter IPs may still see checkpoints; a residential `LINKEDIN_PROXY_URL` can be set if that happens.
- **Terms of Service.** Automated access may violate LinkedIn ToS. This project is a hiring exercise using the operator's own account, not a production scraper.
- **Rate limits.** Burst traffic returns 429; callers should back off.
