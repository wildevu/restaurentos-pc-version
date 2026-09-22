import crypto from 'crypto';
import { RESTAURANTOS_PRODUCTION_PUBLIC_KEY } from './keys';
import { canonicalizePayload, CanonicalLicensePayload } from './canonical';

export interface LicenseVerificationResult {
  valid: boolean;
  error?: string;
  payload?: CanonicalLicensePayload;
  rawKey?: string;
}

/**
 * Parses and verifies an offline Ed25519 digital license for RestaurantOS.
 * Format: ROS-L1.<payloadBase64url>.<signatureBase64url>
 */
export function verifyLicenseKey(
  licenseKey: string,
  expectedInstallationId?: string,
  expectedRestaurantId?: string,
  customPublicKey?: string
): LicenseVerificationResult {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { valid: false, error: 'License key is missing or invalid.' };
  }

  const trimmed = licenseKey.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return {
      valid: false,
      error: 'Malformed license format. Expected format: ROS-L1.<payload>.<signature>',
    };
  }

  const [header, payloadB64, signatureB64] = parts;

  // 1. Verify Format Header
  if (header !== 'ROS-L1') {
    return {
      valid: false,
      error: `Unsupported license format header '${header}'. Expected 'ROS-L1'.`,
    };
  }

  // 2. Decode Payload
  let rawPayloadJson: string;
  let parsedPayload: any;
  try {
    rawPayloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    parsedPayload = JSON.parse(rawPayloadJson);
  } catch (err) {
    return { valid: false, error: 'Failed to decode license payload Base64URL/JSON.' };
  }

  // 3. Schema and Constraints Verification
  if (!parsedPayload || typeof parsedPayload !== 'object') {
    return { valid: false, error: 'Invalid license payload structure.' };
  }

  if (parsedPayload.v !== 1) {
    return { valid: false, error: `Unsupported license version ${parsedPayload.v}.` };
  }

  if (parsedPayload.product !== 'restaurantos') {
    return {
      valid: false,
      error: `Invalid product '${parsedPayload.product}'. License is not for RestaurantOS.`,
    };
  }

  if (
    typeof parsedPayload.durationDays !== 'number' ||
    !Number.isInteger(parsedPayload.durationDays) ||
    parsedPayload.durationDays <= 0
  ) {
    return { valid: false, error: 'Invalid license duration. Must be a positive integer.' };
  }

  if (!parsedPayload.licenseId || typeof parsedPayload.licenseId !== 'string') {
    return { valid: false, error: 'License ID is missing in payload.' };
  }

  if (!parsedPayload.issuedAt || isNaN(Date.parse(parsedPayload.issuedAt))) {
    return { valid: false, error: 'Invalid or missing issuedAt timestamp.' };
  }

  const issuedAtMs = Date.parse(parsedPayload.issuedAt);
  const expiryMs = issuedAtMs + (parsedPayload.durationDays * 24 * 60 * 60 * 1000);
  if (expiryMs <= Date.now()) {
    return {
      valid: false,
      error: `License has expired. Expired on ${new Date(expiryMs).toISOString().slice(0, 10)}.`,
    };
  }

  const parsedType = String(parsedPayload.licenseType || 'STANDARD').toUpperCase().trim();
  const canonicalPayload: CanonicalLicensePayload = {
    v: 1,
    product: 'restaurantos',
    licenseId: parsedPayload.licenseId,
    restaurantId: parsedPayload.restaurantId || '',
    installationId: parsedPayload.installationId || '',
    durationDays: parsedPayload.durationDays,
    issuedAt: parsedPayload.issuedAt,
    licenseType: parsedType === 'PREMIUM' ? 'PREMIUM' : 'STANDARD',
  };

  // 4. Installation and Restaurant Binding Check
  if (expectedInstallationId && canonicalPayload.installationId !== expectedInstallationId) {
    return {
      valid: false,
      error: `License is bound to installation '${canonicalPayload.installationId}', but this hub is '${expectedInstallationId}'.`,
    };
  }

  if (expectedRestaurantId && canonicalPayload.restaurantId && canonicalPayload.restaurantId !== 'default' && canonicalPayload.restaurantId !== expectedRestaurantId) {
    // If hardware installation ID matches this hub, allow seamless renewal/upgrade for the same customer
    if (expectedInstallationId && canonicalPayload.installationId === expectedInstallationId) {
      // Hardware match verified!
    } else {
      return {
        valid: false,
        error: `License is bound to restaurant ID '${canonicalPayload.restaurantId}', not '${expectedRestaurantId}'.`,
      };
    }
  }

  // 5. Ed25519 Cryptographic Signature Verification
  try {
    const canonicalString = canonicalizePayload(canonicalPayload);
    const dataBuffer = Buffer.from(canonicalString, 'utf-8');
    const signatureBuffer = Buffer.from(signatureB64, 'base64url');
    const pubKey = customPublicKey || RESTAURANTOS_PRODUCTION_PUBLIC_KEY;

    const isSignatureValid = crypto.verify(null, dataBuffer, pubKey, signatureBuffer);
    if (!isSignatureValid) {
      return { valid: false, error: 'Cryptographic signature verification failed. The license has been tampered with or corrupted.' };
    }

    return {
      valid: true,
      payload: canonicalPayload,
      rawKey: trimmed,
    };
  } catch (err: any) {
    return { valid: false, error: `Signature verification error: ${err.message}` };
  }
}
