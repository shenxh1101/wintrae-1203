import { Router, Request, Response } from 'express';
import { waitlistService, studentService, courseService, courseSlotService } from '../services';

const router = Router();

router.post('/join', (req: Request, res: Response) => {
  try {
    const { studentName, studentPhone, courseId, slotId } = req.body;
    if (!studentName || !studentPhone || !courseId || !slotId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数',
        details: {
          studentName: studentName ? 'ok' : '必填',
          studentPhone: studentPhone ? 'ok' : '必填',
          courseId: courseId ? 'ok' : '必填',
          slotId: slotId ? 'ok' : '必填'
        }
      });
    }

    const course = courseService.getCourseById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        error: `课程不存在（courseId=${courseId}），请检查参数是否正确`
      });
    }

    const slot = courseSlotService.getCourseSlotById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: `课程时间段不存在（slotId=${slotId}），请检查参数是否正确`
      });
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
      return res.status(404).json({
        success: false,
        error: `候补记录不存在（entryId=${entryId}）`
      });
    }
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:entryId/decline', (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const entry = waitlistService.declineWaitlist(entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: `候补记录不存在（entryId=${entryId}）`
      });
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
      return res.status(404).json({
        success: false,
        error: `候补记录不存在（entryId=${entryId}）`
      });
    }
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:entryId/reschedule', (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    const { newSlotId } = req.body;
    if (!newSlotId) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数 newSlotId（目标时间段ID）'
      });
    }
    const result = waitlistService.rescheduleWaitlist(entryId, newSlotId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: `原候补记录不存在（entryId=${entryId}）`
      });
    }
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/slots/:slotId/release', (req: Request, res: Response) => {
  try {
    const { slotId } = req.params;
    const { count } = req.body;

    if (count !== undefined && (typeof count !== 'number' || Number.isNaN(count))) {
      return res.status(400).json({
        success: false,
        error: `参数 count 必须是数字，当前传入：${JSON.stringify(count)}`
      });
    }

    const releaseCount = count || 1;
    const notifications = waitlistService.releaseSlot(slotId, releaseCount);
    res.json({
      success: true,
      data: {
        releasedCount: releaseCount,
        notifiedCount: notifications.length,
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
    return res.status(404).json({
      success: false,
      error: `候补记录不存在（entryId=${req.params.entryId}）`
    });
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
  res.json({ success: true, message: '已检查超时通知，超时候补已顺延至下一位' });
});

export default router;
