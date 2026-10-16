import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Use a secure parameters for scrypt
const SCRYPT_N = 16384; // CPU/memory cost
const SCRYPT_R = 8;     // Block size
const SCRYPT_P = 1;     // Parallelization cost
const KEY_LEN = 32;     // Derived key length in bytes

/**
 * Hash a password using scrypt (Node native, highly portable, memory-hard).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a scrypt or bcrypt hash asynchronously.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
      return await bcrypt.compare(password, hash);
    }

    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;
    
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, buf) => {
        if (err) reject(err);
        else resolve(buf);
      });
    });
    
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token (e.g. for sessions).
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token (like a session token) so the raw value isn't stored in the database.
 * We use SHA-256 for this as it's fast and we're hashing high-entropy tokens.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
