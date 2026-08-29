import Fastify from 'fastify';
import cors from '@fastify/cors';
import profileRoutes from './routes/profile.js';
import healthRoutes from './routes/health.js';
import { ENDPOINTS } from './linkedin/endpoints.js';
import { voyagerRequest } from './linkedin/client.js';
import { isChromeCdpAvailable, getCdpUrl, disconnectChrome } from './linkedin/chrome.js';
import { closeManagedBrowser, getManagedBrowserInfo } from './linkedin/managed-browser.js';
import { resolveTransport } from './linkedin/http.js';
import { hasCookieAuth } from './linkedin/auth.js';

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, { origin: true });
fastify.register(healthRoutes);
fastify.register(profileRoutes);

const port = Number(process.env.PORT || 3000);

const start = async () => {
  try {
    const transport = await resolveTransport();
    if (transport === 'cdp') {
      console.log(`Transport: Chrome DevTools at ${getCdpUrl()}`);
    } else {
      const info = getManagedBrowserInfo();
      console.log(`Transport: managed Chromium (${info.executablePath})`);
      console.log(`Session profile: ${info.profileDir} (survives restarts; re-paste cookies only when LinkedIn logs it out)`);
      if (!hasCookieAuth()) {
        console.error('ERROR: LINKEDIN_LI_AT and LINKEDIN_JSESSIONID (or LINKEDIN_COOKIE) are required for server Chromium.');
        process.exit(1);
      }
    }

    console.log('Probing LinkedIn session...');
    try {
      await voyagerRequest({ url: ENDPOINTS.ME });
      console.log('LinkedIn session is valid.');
    } catch (err: any) {
      console.error(`WARNING: LinkedIn probe failed (${err.name || 'Error'}): ${err.message}`);
      console.error('API will still listen. Profile calls will fail until the session is updated and the process is restarted.');
    }

    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

const shutdown = async () => {
  await disconnectChrome();
  await closeManagedBrowser();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
