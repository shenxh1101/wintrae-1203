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

router.get('/operation-dashboard', (req: Request, res: Response) => {
  const storeId = (req.query.storeId as string) || undefined;
  const courseId = (req.query.courseId as string) || undefined;
  const slotId = (req.query.slotId as string) || undefined;
  const dateFrom = (req.query.dateFrom as string) || undefined;
  const dateTo = (req.query.dateTo as string) || undefined;

  const dashboard = statisticsService.getOperationDashboard(storeId, courseId, slotId, dateFrom, dateTo);
  res.json({ success: true, data: dashboard });
});

router.get('/daily-trend', (req: Request, res: Response) => {
  const dateFrom = (req.query.dateFrom as string) || undefined;
  const dateTo = (req.query.dateTo as string) || undefined;

  const trend = statisticsService.getDailyTrend(undefined, dateFrom, dateTo);
  res.json({ success: true, data: trend, filters: { dateFrom: dateFrom || null, dateTo: dateTo || null } });
});

router.get('/funnel', (req: Request, res: Response) => {
  const storeId = (req.query.storeId as string) || undefined;
  const courseId = (req.query.courseId as string) || undefined;
  const dateFrom = (req.query.dateFrom as string) || undefined;
  const dateTo = (req.query.dateTo as string) || undefined;
  const hotspotDays = parseInt(req.query.hotspotDays as string) || 7;

  const funnel = statisticsService.getFunnelAnalysis(storeId, courseId, dateFrom, dateTo, hotspotDays);
  res.json({
    success: true,
    data: funnel,
    filters: {
      storeId: storeId || null,
      courseId: courseId || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      hotspotDays
    }
  });
});

export default router;
