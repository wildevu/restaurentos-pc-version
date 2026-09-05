import { Request, Response, NextFunction } from 'express';
import { LicensingService } from './service';

const EXEMPT_PATHS = [
  '/api/health',
  '/api/auth/status',
  '/api/auth/setup-status',
  '/api/auth/setup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/pair',
  '/api/licensing/status',
  '/api/licensing/activate',
  '/api/hub/status',
];

export async function licenseEnforcementMiddleware(req: Request, res: Response, next: NextFunction) {
  // Pass non-API requests (PWA assets, static files)
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Pass exempt authentication and licensing setup endpoints
  if (EXEMPT_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  try {
    const status = await LicensingService.getStatus();
    if (!status.canOperate) {
      return res.status(402).json({
        error: 'LICENSE_REQUIRED',
        code: status.status,
        installationId: status.installationId,
        message: status.status === 'EXPIRED'
          ? 'RestaurantOS license has expired. Please renew your license to continue operations.'
          : status.status === 'CLOCK_ROLLBACK_DETECTED'
          ? 'System clock rollback detected. Please restore the correct date/time on the Local Hub PC.'
          : 'A valid RestaurantOS license is required to perform operational actions.',
      });
    }

    // Attach license info to request
    (req as any).licenseStatus = status;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to verify license status.', details: err.message });
  }
}
