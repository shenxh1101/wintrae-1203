import { Router, Request, Response } from 'express';
import { waitlistService, studentService, courseService, courseSlotService } from '../services';

const router = Router();

router.post('/join', (req: Request, res: Response) => {
  try {
    const { studentName, studentPhone, courseId, slotId } = req.body;
    if (!studentName || !studentPhone || !courseId || !slotId) {
      return res.status(400).json({ success: false, error: '学员姓名、手机号、课程ID、时间段ID不能为空' });
    }

    const course = courseService.getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, error: '课程不存在' });
    }

    const slot = courseSlotService.getCourseSlotById(slotId);
    if (!slot) {
      return res.status(404).json({ success: false, error: '课程时间段不存在' });
    }

    const student = studentService.getOrCreateStudent(studentName, studentPhone);
    const entry = waitlistService.joinWaitlist(student, course, slot);

    res.json({
      success: true,
      data: {
        waitlistEntry: entry,
        positionInfo: waitlistService.getWaitlistPosition(entry.id)
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:entryId/cancel', (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const entry = waitlistService.cancelWaitlist(entryId);
    if (!entry) {
      return res.status(404).json({ success: false, error: '候补记录不存在' });
    }
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:entryId/confirm', (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const entry = waitlistService.confirmWaitlist(entryId);
    if (!entry) {
      return res.status(404).json({ success: false, error: '候补记录不存在' });
    }
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/slots/:slotId/release', (req: Request, res: Response) => {
  try {
    const { slotId } = req.params;
    const { count } = req.body;
    const releaseCount = count || 1;
    const notifications = waitlistService.releaseSlot(slotId, releaseCount);
    res.json({
      success: true,
      data: {
        releasedCount: releaseCount,
        notifications
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/entries/:entryId/position', (req: Request, res: Response) => {
  const info = waitlistService.getWaitlistPosition(req.params.entryId);
  if (!info) {
    return res.status(404).json({ success: false, error: '候补记录不存在' });
  }
  res.json({ success: true, data: info });
});

router.get('/students/:studentId/entries', (req: Request, res: Response) => {
  const entries = waitlistService.getStudentWaitlist(req.params.studentId);
  res.json({ success: true, data: entries });
});

router.get('/slots/:slotId/entries', (req: Request, res: Response) => {
  const entries = waitlistService.getSlotWaitlist(req.params.slotId);
  res.json({ success: true, data: entries });
});

router.post('/check-expired', (req: Request, res: Response) => {
  waitlistService.checkExpiredNotifications();
  res.json({ success: true, message: '已检查超时通知' });
});

export default router;
