/**
 * RestaurantOS — Offline License Generator Tool (Founder / Support Utility)
 * 
 * Generates signed ROS-L1 offline digital licenses for RestaurantOS Local Hubs.
 */

const crypto = require('crypto');

function canonicalizePayload(payload) {
  const licenseTypeVal = String(payload.licenseType || 'STANDARD').toUpperCase().trim();
  const canonicalObject = {
    durationDays: Math.floor(payload.durationDays),
    installationId: String(payload.installationId || '').trim(),
    issuedAt: String(payload.issuedAt || new Date().toISOString()).trim(),
    licenseId: String(payload.licenseId || `lic_${crypto.randomBytes(8).toString('hex')}`).trim(),
    licenseType: licenseTypeVal === 'PREMIUM' ? 'PREMIUM' : 'STANDARD',
    product: 'restaurantos',
    restaurantId: String(payload.restaurantId || '').trim(),
    v: 1,
  };
  return JSON.stringify(canonicalObject);
}

function generateLicenseKey(payload, privateKeyPem) {
  const canonical = canonicalizePayload(payload);
  const dataBuf = Buffer.from(canonical, 'utf-8');

  // If no private key passed, generate an ephemeral or use matching test key
  let signingKey = privateKeyPem;
  if (!signingKey) {
    // For internal script testing, default to ephemeral or provided test key
    const pair = crypto.generateKeyPairSync('ed25519');
    signingKey = pair.privateKey;
  }

  const sigBuf = crypto.sign(null, dataBuf, signingKey);
  const payloadB64 = Buffer.from(canonical, 'utf-8').toString('base64url');
  const sigB64 = sigBuf.toString('base64url');
  return `ROS-L1.${payloadB64}.${sigB64}`;
}

module.exports = {
  canonicalizePayload,
  generateLicenseKey,
};
