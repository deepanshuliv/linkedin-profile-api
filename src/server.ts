import Fastify from 'fastify';
import cors from '@fastify/cors';
import profileRoutes from './routes/profile.js';
import healthRoutes from './routes/health.js';
import { ENDPOINTS } from './linkedin/endpoints.js';
import { voyagerRequest } from './linkedin/client.js';
import { getAuth } from './linkedin/auth.js';

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, { origin: true });
fastify.register(healthRoutes);
fastify.register(profileRoutes);

const port = Number(process.env.PORT || 3000);

const start = async () => {
  try {
    getAuth();
    console.log('Probing LinkedIn Voyager session...');
    try {
      await voyagerRequest({ url: ENDPOINTS.ME });
      console.log('LinkedIn session is valid.');
    } catch (err: any) {
      console.error(`WARNING: LinkedIn probe failed (${err.name || 'Error'}): ${err.message}`);
      console.error('The API is up, but profile requests will fail until LINKEDIN_LI_AT and LINKEDIN_JSESSIONID are refreshed from a voyager/api request in Chrome DevTools.');
    }

    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
