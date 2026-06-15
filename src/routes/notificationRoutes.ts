import { Router, Request, Response } from 'express';
import { notificationService } from '../services';

const router = Router();

router.get('/:id', (req: Request, res: Response) => {
  const notification = notificationService.getNotificationById(req.params.id);
  if (!notification) {
    return res.status(404).json({ success: false, error: '通知记录不存在' });
  }
  res.json({ success: true, data: notification });
});

router.get('/students/:studentId', (req: Request, res: Response) => {
  const notifications = notificationService.getNotificationsByStudentId(req.params.studentId);
  res.json({ success: true, data: notifications });
});

router.get('/waitlist/:entryId', (req: Request, res: Response) => {
  const notifications = notificationService.getNotificationsByWaitlistEntryId(req.params.entryId);
  res.json({ success: true, data: notifications });
});

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: notificationService.getAllNotifications() });
});

export default router;
