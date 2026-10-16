/**
 * RestaurantOS Offline Licensing - Canonical Serialization
 * 
 * CANONICALIZATION SPECIFICATION FOR FOUNDER PLATFORM COMPATIBILITY:
 * 1. Encoding: Standard UTF-8 without byte-order mark (BOM).
 * 2. Property Sorting: Lexicographical ascending ASCII sort on top-level keys:
 *    - durationDays
 *    - installationId
 *    - issuedAt
 *    - licenseId
 *    - product
 *    - restaurantId
 *    - v
 * 3. Whitespace: No extraneous whitespace or newlines between keys, colons, or values.
 * 4. Number Formatting: Plain integer notation (no floating points or scientific notation).
 * 5. String Escaping: Standard RFC 8259 JSON string encoding.
 */

export interface CanonicalLicensePayload {
  v: number;
  product: string;
  licenseId: string;
  restaurantId: string;
  installationId: string;
  durationDays: number;
  issuedAt: string;
  licenseType?: 'STANDARD' | 'PREMIUM';
}

export function canonicalizePayload(payload: CanonicalLicensePayload): string {
  const licenseTypeVal = (payload.licenseType || 'STANDARD').toUpperCase().trim();
  const canonicalObject = {
    durationDays: Math.floor(payload.durationDays),
    installationId: String(payload.installationId).trim(),
    issuedAt: String(payload.issuedAt).trim(),
    licenseId: String(payload.licenseId).trim(),
    licenseType: licenseTypeVal === 'PREMIUM' ? 'PREMIUM' : 'STANDARD',
    product: String(payload.product).trim(),
    restaurantId: String(payload.restaurantId).trim(),
    v: Math.floor(payload.v),
  };

  return JSON.stringify(canonicalObject);
}
