import { FastifyInstance } from 'fastify';
import { hasCookieAuth } from '../linkedin/auth.js';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async () => ({
    name: 'LinkedIn Profile API',
    description: 'POST or GET a LinkedIn profile URL; returns structured JSON from LinkedIn Voyager endpoints.',
    endpoints: {
      health: 'GET /health',
      profile: 'POST /api/linkedin/profile  { "url": "https://www.linkedin.com/in/slug" }',
      profileQuery: 'GET /api/linkedin/profile?url=https://www.linkedin.com/in/slug',
    },
  }));

  fastify.get('/health', async () => ({
    ok: true,
    cookiesConfigured: hasCookieAuth(),
  }));
}
