export class InvalidLinkedInUrlError extends Error {
  constructor(message: string = 'Invalid LinkedIn URL') {
    super(message);
    this.name = 'InvalidLinkedInUrlError';
  }
}

export class ExpiredSessionError extends Error {
  constructor(message: string = 'LinkedIn session expired (401)') {
    super(message);
    this.name = 'ExpiredSessionError';
  }
}

export class BotChallengeError extends Error {
  constructor(
    message: string = 'LinkedIn blocked the request (bot/WAF challenge). Update backend session cookies and retry.'
  ) {
    super(message);
    this.name = 'BotChallengeError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'LinkedIn forbidden (403)') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ProfileNotFoundError extends Error {
  constructor(message: string = 'Profile not found (404)') {
    super(message);
    this.name = 'ProfileNotFoundError';
  }
}

export class EndpointGoneError extends Error {
  constructor(message: string = 'Endpoint gone (410)') {
    super(message);
    this.name = 'EndpointGoneError';
  }
}

export class RateLimitedError extends Error {
  constructor(message: string = 'Rate limited (429)') {
    super(message);
    this.name = 'RateLimitedError';
  }
}

export class LinkedInServerError extends Error {
  constructor(message: string = 'LinkedIn server error (5xx)') {
    super(message);
    this.name = 'LinkedInServerError';
  }
}
