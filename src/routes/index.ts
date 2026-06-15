import { Router } from 'express';
import basicRoutes from './basicRoutes';
import waitlistRoutes from './waitlistRoutes';
import notificationRoutes from './notificationRoutes';
import statisticsRoutes from './statisticsRoutes';

const router = Router();

router.use('/basic', basicRoutes);
router.use('/waitlist', waitlistRoutes);
router.use('/notifications', notificationRoutes);
router.use('/statistics', statisticsRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '课程候补与补位通知服务运行正常',
    timestamp: new Date().toISOString()
  });
});

export default router;
