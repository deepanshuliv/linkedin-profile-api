import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { resolveProfile } from '../linkedin/resolve.js';
import { parseLinkedInProfileUrl } from '../linkedin/url.js';

interface ProfileBody {
  url?: string;
}

interface ProfileQuery {
  url?: string;
}

async function handleProfile(url: unknown, reply: FastifyReply, log: FastifyRequest['log']) {
  try {
    const slug = parseLinkedInProfileUrl(url);
    const profile = await resolveProfile(slug);
    return reply.send(profile);
  } catch (err: any) {
    if (err.name === 'InvalidLinkedInUrlError') {
      return reply.status(400).send({ error: err.message });
    }
    if (err.name === 'ExpiredSessionError') {
      return reply.status(401).send({ error: err.message });
    }
    if (err.name === 'BotChallengeError') {
      return reply.status(403).send({ error: err.message });
    }
    if (err.name === 'ForbiddenError') {
      return reply.status(403).send({ error: err.message });
    }
    if (err.name === 'ProfileNotFoundError') {
      return reply.status(404).send({ error: err.message });
    }
    if (err.name === 'EndpointGoneError') {
      return reply.status(410).send({ error: err.message });
    }
    if (err.name === 'RateLimitedError') {
      return reply.status(429).send({ error: err.message });
    }
    if (err.name === 'LinkedInServerError') {
      return reply.status(502).send({ error: err.message });
    }

    log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.post('/api/linkedin/profile', async (request: FastifyRequest<{ Body: ProfileBody }>, reply: FastifyReply) => {
    return handleProfile(request.body?.url, reply, request.log);
  });

  fastify.get('/api/linkedin/profile', async (request: FastifyRequest<{ Querystring: ProfileQuery }>, reply: FastifyReply) => {
    return handleProfile(request.query?.url, reply, request.log);
  });
}
