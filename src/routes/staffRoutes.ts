import { Router, Request, Response } from 'express';
import { getStaffModel, getVault1BStaffModel } from '../config/database.js';
import { characterStaffService } from '../services/characterStaffService.js';

export const staffRouter = Router();

/**
 * GET /api/v1/staff/search?q={query}&limit=20
 * Search production staff, voice actors, and creators
 */
staffRouter.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    if (!q) {
      res.status(400).json({ success: false, error: 'Query parameter ?q= is required.' });
      return;
    }

    const staffList = await characterStaffService.searchStaff(q, limit);

    res.json({
      success: true,
      query: q,
      total: staffList.length,
      data: staffList,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/staff/:idOrSlug
 * Retrieve comprehensive person profile with biography, verified social links, and works
 */
staffRouter.get('/:idOrSlug', async (req: Request, res: Response): Promise<void> => {
  try {
    const idOrSlug = String(req.params.idOrSlug).trim();
    const StaffModel = getStaffModel();
    const Vault1BStaffModel = getVault1BStaffModel();

    let person: any = null;
    const numericId = Number(idOrSlug);

    if (!isNaN(numericId)) {
      person = await StaffModel.findOne({
        $or: [{ staffId: numericId }, { malId: numericId }],
      }).lean();
      if (!person && Vault1BStaffModel) {
        person = await Vault1BStaffModel.findOne({
          $or: [{ staffId: numericId }, { malId: numericId }],
        }).lean();
      }
    } else {
      person = await StaffModel.findOne({
        $or: [
          { slug: idOrSlug },
          { slug: new RegExp(`^${idOrSlug}`, 'i') },
        ],
      }).lean();
      if (!person && Vault1BStaffModel) {
        person = await Vault1BStaffModel.findOne({
          $or: [
            { slug: idOrSlug },
            { slug: new RegExp(`^${idOrSlug}`, 'i') },
          ],
        }).lean();
      }
    }

    // On-Demand Ingestion: if not in database, attempt real-time fetch & cache
    if (!person && !isNaN(numericId)) {
      const rawStaff = await characterStaffService.fetchStaffFromAniList(numericId);
      if (rawStaff) {
        const saved = await characterStaffService.saveStaff(rawStaff);
        if (saved) person = saved.toObject();
      }
    }

    if (!person) {
      res.status(404).json({
        success: false,
        error: `Staff / Voice Actor '${idOrSlug}' not found in AniNexus archives.`,
      });
      return;
    }

    res.json({
      success: true,
      data: person,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
