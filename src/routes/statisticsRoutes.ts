import { Router, Request, Response } from 'express';
import { statisticsService } from '../services';

const router = Router();

router.get('/course-heat-rank', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const ranks = statisticsService.getCourseHeatRank(limit);
  res.json({ success: true, data: ranks });
});

router.get('/store-conversions', (req: Request, res: Response) => {
  const conversions = statisticsService.getStoreConversions();
  res.json({ success: true, data: conversions });
});

router.get('/overview', (req: Request, res: Response) => {
  const stats = statisticsService.getOverallStatistics();
  res.json({ success: true, data: stats });
});

export default router;
