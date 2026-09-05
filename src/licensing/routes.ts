import { Router, Request, Response } from 'express';
import { LicensingService } from './service';

export const licensingRouter = Router();

/**
 * GET /api/licensing/status
 * Exposes current offline license status, installation ID, and validity.
 */
licensingRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await LicensingService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve license status.', details: err.message });
  }
});

/**
 * GET /api/licensing/installation
 * Exposes the unique local installation ID required for issuing offline licenses.
 */
licensingRouter.get('/installation', async (req: Request, res: Response) => {
  try {
    const inst = await LicensingService.getOrCreateInstallation();
    res.json({ installationId: inst.id, restaurantId: inst.restaurantId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve installation identity.', details: err.message });
  }
});

/**
 * POST /api/licensing/activate
 * Activates or renews an offline license key.
 * Allows unauthenticated initial activation or authenticated OWNER/MANAGER renewal.
 */
licensingRouter.post('/activate', async (req: Request, res: Response) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey || typeof licenseKey !== 'string') {
      return res.status(400).json({ error: 'License key is required.' });
    }

    const actorUserId = (req as any).user?.id || undefined;
    const result = await LicensingService.activate(licenseKey, actorUserId);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'License activation failed.' });
    }

    res.json({
      success: true,
      message: 'License activated successfully.',
      status: result.statusInfo,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error during license activation.', details: err.message });
  }
});
