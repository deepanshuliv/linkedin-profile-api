import { voyagerRequest } from './client.js';
import { ENDPOINTS } from './endpoints.js';
import { encodeRestLi } from './encoder.js';
import { Normalizer } from './normalizer.js';
import { parseProfile } from './parser.js';
import { VoyagerResponse, LinkedInProfileResponse } from './types.js';
import { ProfileNotFoundError } from './errors.js';

export async function resolveProfile(publicIdentifier: string): Promise<LinkedInProfileResponse> {
  try {
    const dashResponse = await fetchDashProfile(publicIdentifier);
    const normalizer = new Normalizer(dashResponse);
    return parseProfile(normalizer, publicIdentifier, 'dash');
  } catch (err: any) {
    if (
      err.name === 'ExpiredSessionError' ||
      err.name === 'ForbiddenError' ||
      err.name === 'BotChallengeError' ||
      err.name === 'EndpointGoneError' ||
      err.name === 'RateLimitedError'
    ) {
      throw err;
    }
    console.warn(`Dash endpoint failed for ${publicIdentifier}, falling back to GraphQL...`, err.message);
  }

  try {
    const gqlResponse = await fetchGraphQLProfile(publicIdentifier);
    let normalizer = new Normalizer(gqlResponse);
    let profileData = parseProfile(normalizer, publicIdentifier, 'graphql');

    if (profileData.meta.partial && profileData.entityUrn) {
      try {
        const cardsResponse = await fetchGraphQLProfileCards(profileData.entityUrn);
        const combinedIncluded = [...(gqlResponse.included || []), ...(cardsResponse.included || [])];
        normalizer = new Normalizer({ data: gqlResponse.data, included: combinedIncluded });
        profileData = parseProfile(normalizer, publicIdentifier, 'graphql+cards');
      } catch (secondaryErr: any) {
        console.warn(`Secondary GraphQL fetch failed for ${publicIdentifier}`, secondaryErr.message);
      }
    }

    return profileData;
  } catch (err: any) {
    if (err.message && err.message.includes('Could not find primary profile')) {
      throw new ProfileNotFoundError(`Profile ${publicIdentifier} not found or not accessible.`);
    }
    throw err;
  }
}

async function fetchDashProfile(publicIdentifier: string): Promise<VoyagerResponse> {
  return voyagerRequest<VoyagerResponse>({
    url: ENDPOINTS.DASH_PROFILES,
    params: {
      q: 'memberIdentity',
      memberIdentity: publicIdentifier,
      decorationId: ENDPOINTS.DASH_DECORATION_ID,
    },
    retries: 1,
  });
}

async function fetchGraphQLProfile(publicIdentifier: string): Promise<VoyagerResponse> {
  try {
    return await voyagerRequest<VoyagerResponse>({
      url: ENDPOINTS.GRAPHQL,
      params: {
        includeWebMetadata: 'true',
        variables: encodeRestLi({ vanityName: publicIdentifier }),
        queryName: ENDPOINTS.GRAPHQL_PROFILES_QUERY_NAME,
      },
      retries: 1,
    });
  } catch (err: any) {
    if (
      err.name === 'ExpiredSessionError' ||
      err.name === 'ForbiddenError' ||
      err.name === 'BotChallengeError' ||
      err.name === 'RateLimitedError'
    ) {
      throw err;
    }
    return voyagerRequest<VoyagerResponse>({
      url: ENDPOINTS.GRAPHQL,
      params: {
        includeWebMetadata: 'true',
        variables: encodeRestLi({ memberIdentity: publicIdentifier }),
        queryId: ENDPOINTS.GRAPHQL_PROFILES_QUERY_ID,
      },
      retries: 1,
    });
  }
}

async function fetchGraphQLProfileCards(profileUrn: string): Promise<VoyagerResponse> {
  return voyagerRequest<VoyagerResponse>({
    url: ENDPOINTS.GRAPHQL,
    params: {
      variables: encodeRestLi({ profileUrn }),
      queryId: ENDPOINTS.GRAPHQL_PROFILE_CARDS_QUERY_ID,
    },
    retries: 1,
  });
}
