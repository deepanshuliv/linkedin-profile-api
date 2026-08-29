import { InvalidLinkedInUrlError } from './errors.js';

export function parseLinkedInProfileUrl(url: unknown): string {
  if (!url || typeof url !== 'string') {
    throw new InvalidLinkedInUrlError('Missing or invalid "url". Pass a LinkedIn profile URL.');
  }

  const match = url.trim().match(/^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^\/?#]+)/i);
  if (!match?.[1]) {
    throw new InvalidLinkedInUrlError(
      'Invalid LinkedIn URL. Expected a public profile such as https://www.linkedin.com/in/slug'
    );
  }

  return decodeURIComponent(match[1]);
}
