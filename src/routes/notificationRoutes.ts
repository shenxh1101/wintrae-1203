import { Router, Request, Response } from 'express';
import { notificationService, waitlistService } from '../services';

const router = Router();

router.get('/pending', (req: Request, res: Response) => {
  const pending = notificationService.getPendingNotificationsWithRemaining();
  res.json({ success: true, data: pending });
});

router.get('/:id/detail', (req: Request, res: Response) => {
  const detail = notificationService.getNotificationDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ success: false, error: '通知记录不存在' });
  }
  res.json({ success: true, data: detail });
});

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

router.post('/waitlist/:entryId/resend-reminder', (req: Request, res: Response) => {
  try {
    const reminder = notificationService.resendReminder(req.params.entryId);
    if (!reminder) {
      return res.status(404).json({ success: false, error: '候补记录不存在' });
    }
    res.json({ success: true, data: reminder });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/waitlist/:entryId/force-decline', (req: Request, res: Response) => {
  try {
    const notif = notificationService.forceDecline(req.params.entryId);
    if (!notif) {
      return res.status(404).json({ success: false, error: '候补记录不存在' });
    }

    const entry = waitlistService.declineWaitlist(req.params.entryId);

    res.json({
      success: true,
      data: {
        notification: notif,
        waitlistEntry: entry
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
