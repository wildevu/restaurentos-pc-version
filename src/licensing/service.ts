import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db';
import { installations, licenses, auditEvents, restaurants } from '../db/schema';
import { verifyLicenseKey } from './verifier';
import { logger } from '../logger';

export interface LicenseStatusInfo {
  status: 'ACTIVE' | 'EXPIRED' | 'UNLICENSED' | 'CLOCK_ROLLBACK_DETECTED';
  isLicensed: boolean;
  canOperate: boolean;
  installationId: string;
  restaurantId?: string;
  licenseId?: string;
  durationDays?: number;
  activatedAt?: string;
  expiresAt?: string;
  remainingDays?: number;
  clockRollbackDetected?: boolean;
}

export class LicensingService {
  private static cachedInstallationId: string | null = null;

  /**
   * Retrieves or creates the unique, persistent Installation ID for this Local Hub.
   * Stored in the SQLite database in C:\ProgramData\RestaurantOS so it persists across software updates.
   */
  static async getOrCreateInstallation(): Promise<{ id: string; restaurantId?: string | null; lastSeenTime: Date }> {
    const existing = await db.select().from(installations).limit(1);
    if (existing.length > 0) {
      this.cachedInstallationId = existing[0].id;
      return existing[0];
    }

    // Generate permanent installation ID (prefix inst_ + 24 hex characters)
    const newId = `inst_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date();

    // Check if restaurant already exists
    const rest = await db.select().from(restaurants).limit(1);
    const restId = rest.length > 0 ? rest[0].id : null;

    const [created] = await db.insert(installations).values({
      id: newId,
      restaurantId: restId,
      createdAt: now,
      lastSeenTime: now,
    }).returning();

    this.cachedInstallationId = created.id;
    return created;
  }

  /**
   * Clock Safety Verification:
   * Protects against system-clock rollback. If current time is earlier than last_seen_time by > 10 minutes,
   * flags clock anomaly. Otherwise, updates last_seen_time.
   */
  static async verifyClockSafety(inst: { id: string; lastSeenTime: Date }): Promise<{ safe: boolean; differenceMs: number }> {
    const now = new Date();
    const lastSeen = new Date(inst.lastSeenTime);
    const thresholdMs = 10 * 60 * 1000; // 10 minutes leeway for minor NTP sync adjustments

    if (now.getTime() < lastSeen.getTime() - thresholdMs) {
      logger.warn('[Licensing] System clock rollback detected!', {
        systemTime: now.toISOString(),
        lastSeenTime: lastSeen.toISOString(),
      });
      return { safe: false, differenceMs: lastSeen.getTime() - now.getTime() };
    }

    // Advance lastSeenTime if system time moved forward
    if (now.getTime() > lastSeen.getTime()) {
      await db.update(installations)
        .set({ lastSeenTime: now })
        .where(eq(installations.id, inst.id));
    }

    return { safe: true, differenceMs: 0 };
  }

  /**
   * Retrieves authoritative local license status.
   */
  static async getStatus(): Promise<LicenseStatusInfo> {
    const inst = await this.getOrCreateInstallation();
    const clockCheck = await this.verifyClockSafety(inst);

    if (!clockCheck.safe) {
      return {
        status: 'CLOCK_ROLLBACK_DETECTED',
        isLicensed: false,
        canOperate: false,
        installationId: inst.id,
        restaurantId: inst.restaurantId || undefined,
        clockRollbackDetected: true,
      };
    }

    // Query current active license
    const activeLicenses = await db.select().from(licenses)
      .where(eq(licenses.installationId, inst.id))
      .orderBy(desc(licenses.activatedAt));

    const active = activeLicenses.find(l => l.status === 'ACTIVE');

    if (!active) {
      return {
        status: 'UNLICENSED',
        isLicensed: false,
        canOperate: false,
        installationId: inst.id,
        restaurantId: inst.restaurantId || undefined,
      };
    }

    const now = new Date();
    const expiresAt = new Date(active.expiresAt);
    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    if (now.getTime() >= expiresAt.getTime()) {
      // Mark as expired if not already marked
      await db.update(licenses)
        .set({ status: 'EXPIRED' })
        .where(eq(licenses.id, active.id));

      return {
        status: 'EXPIRED',
        isLicensed: false,
        canOperate: false,
        installationId: inst.id,
        restaurantId: inst.restaurantId || undefined,
        licenseId: active.id,
        durationDays: active.durationDays,
        activatedAt: new Date(active.activatedAt).toISOString(),
        expiresAt: expiresAt.toISOString(),
        remainingDays: 0,
      };
    }

    return {
      status: 'ACTIVE',
      isLicensed: true,
      canOperate: true,
      installationId: inst.id,
      restaurantId: inst.restaurantId || undefined,
      licenseId: active.id,
      durationDays: active.durationDays,
      activatedAt: new Date(active.activatedAt).toISOString(),
      expiresAt: expiresAt.toISOString(),
      remainingDays,
    };
  }

  /**
   * Activates or Renews an offline license on this Local Hub.
   */
  static async activate(rawKey: string, actorUserId?: string, customPublicKey?: string): Promise<{
    success: boolean;
    error?: string;
    statusInfo?: LicenseStatusInfo;
  }> {
    const inst = await this.getOrCreateInstallation();

    // 1. Verify license key cryptography & payload
    const verification = verifyLicenseKey(
      rawKey,
      inst.id,
      inst.restaurantId || undefined,
      customPublicKey
    );

    if (!verification.valid || !verification.payload) {
      logger.warn('[Licensing] License activation rejected:', { error: verification.error });
      return { success: false, error: verification.error || 'Invalid license key.' };
    }

    const payload = verification.payload;
    const now = new Date();
    const activatedAt = now;
    const issuedAtMs = new Date(payload.issuedAt).getTime();
    const durationMs = payload.durationDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(issuedAtMs + durationMs);

    // 2. Mark previous ACTIVE licenses as SUPERSEDED
    await db.update(licenses)
      .set({ status: 'SUPERSEDED' })
      .where(eq(licenses.installationId, inst.id));

    // 3. Persist the new active license record (upsert to handle re-activation smoothly)
    const existingLicense = await db.select().from(licenses).where(eq(licenses.id, payload.licenseId)).limit(1);
    if (existingLicense.length > 0) {
      await db.update(licenses).set({
        rawLicenseKey: rawKey.trim(),
        product: payload.product,
        version: payload.v,
        restaurantId: payload.restaurantId || inst.restaurantId || 'default',
        installationId: inst.id,
        durationDays: payload.durationDays,
        issuedAt: new Date(payload.issuedAt),
        activatedAt,
        expiresAt,
        status: 'ACTIVE',
      }).where(eq(licenses.id, payload.licenseId));
    } else {
      await db.insert(licenses).values({
        id: payload.licenseId,
        rawLicenseKey: rawKey.trim(),
        product: payload.product,
        version: payload.v,
        restaurantId: payload.restaurantId || inst.restaurantId || 'default',
        installationId: inst.id,
        durationDays: payload.durationDays,
        issuedAt: new Date(payload.issuedAt),
        activatedAt,
        expiresAt,
        status: 'ACTIVE',
        createdAt: now,
      });
    }

    // 4. Record persistent audit event
    await db.insert(auditEvents).values({
      id: `audit_${crypto.randomBytes(8).toString('hex')}`,
      restaurantId: inst.restaurantId,
      actorUserId: actorUserId || null,
      action: 'LICENSE_ACTIVATED',
      entityType: 'LICENSE',
      entityId: payload.licenseId,
      metadata: JSON.stringify({
        durationDays: payload.durationDays,
        expiresAt: expiresAt.toISOString(),
        issuedAt: payload.issuedAt,
      }),
      createdAt: now,
    });

    logger.info('[Licensing] License activated successfully!', {
      licenseId: payload.licenseId,
      durationDays: payload.durationDays,
      expiresAt: expiresAt.toISOString(),
    });

    const statusInfo = await this.getStatus();
    return { success: true, statusInfo };
  }
}
