/**
 * Encodes variables for Rest.li 2.0 URLs.
 * Do not encodeURIComponent() the whole variables=(...) string.
 * - object: (k1:v1,k2:v2)
 * - array: List(a,b)
 * - URL-encode leaf values only
 * - keep structural parentheses, commas, and List unencoded as syntax
 */
export function encodeRestLi(variables: any): string {
  if (variables === null || variables === undefined) {
    return '';
  }

  if (Array.isArray(variables)) {
    return `List(${variables.map(v => encodeRestLi(v)).join(',')})`;
  }

  if (typeof variables === 'object') {
    const parts = [];
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        parts.push(`${key}:${encodeRestLi(value)}`);
      }
    }
    return `(${parts.join(',')})`;
  }

  // Primitive value: URL-encode it
  return encodeURIComponent(String(variables));
}
