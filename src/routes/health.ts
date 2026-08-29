import { FastifyInstance } from 'fastify';
import { isChromeCdpAvailable } from '../linkedin/chrome.js';
import { hasCookieAuth } from '../linkedin/auth.js';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async () => ({
    name: 'LinkedIn Profile API',
    description: 'POST or GET a LinkedIn profile URL; returns structured JSON from LinkedIn Voyager APIs.',
    endpoints: {
      health: 'GET /health',
      profile: 'POST /api/linkedin/profile  { "url": "https://www.linkedin.com/in/slug" }',
      profileQuery: 'GET /api/linkedin/profile?url=https://www.linkedin.com/in/slug',
    },
  }));

  fastify.get('/health', async () => {
    const cdp = await isChromeCdpAvailable();
    return {
      ok: true,
      transport: cdp ? 'cdp' : 'managed-chrome',
      cookiesConfigured: hasCookieAuth(),
    };
  });
}
