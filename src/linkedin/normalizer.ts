import { VoyagerResponse } from './types.js';

export class Normalizer {
  private index: Map<string, any>;

  constructor(private response: VoyagerResponse) {
    this.index = new Map();
    if (Array.isArray(response.included)) {
      for (const item of response.included) {
        if (item.entityUrn) {
          this.index.set(item.entityUrn, item);
        }
      }
    }
  }

  get(urn: string | null | undefined): any | null {
    if (!urn) return null;
    return this.index.get(urn) || null;
  }

  getAllOfType(typeSuffix: string): any[] {
    const results = [];
    for (const item of this.index.values()) {
      if (item.$type && item.$type.endsWith(typeSuffix)) {
        results.push(item);
      }
    }
    return results;
  }

  /**
   * Find the primary profile object.
   * Logic:
   * 1. If publicIdentifier is given, try to find an item with that publicIdentifier and type ends with Profile.
   * 2. Otherwise, look at response.data.*elements[0] (which is the main entity returned) and look that up.
   */
  findPrimaryProfile(publicIdentifier: string): any | null {
    // Attempt 1: match public identifier
    for (const item of this.index.values()) {
      if (
        item.publicIdentifier === publicIdentifier &&
        (item.$type === 'com.linkedin.voyager.dash.identity.profile.Profile' ||
         item.$type === 'com.linkedin.voyager.identity.shared.MiniProfile')
      ) {
        return item;
      }
    }

    // Attempt 2: via *elements
    if (this.response.data && Array.isArray(this.response.data['*elements'])) {
      const firstUrn = this.response.data['*elements'][0];
      if (firstUrn) {
        const item = this.get(firstUrn);
        if (item && item.$type && item.$type.includes('Profile')) {
          return item;
        }
      }
    }

    return null;
  }
}
