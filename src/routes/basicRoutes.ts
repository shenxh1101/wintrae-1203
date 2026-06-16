import { Router, Request, Response } from 'express';
import { storeService, courseService, courseSlotService, studentService } from '../services';

const router = Router();

router.post('/stores', (req: Request, res: Response) => {
  try {
    const { name, address } = req.body;
    if (!name || !address) {
      return res.status(400).json({ error: '门店名称和地址不能为空' });
    }
    const store = storeService.createStore(name, address);
    res.json({ success: true, data: store });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/stores', (req: Request, res: Response) => {
  res.json({ success: true, data: storeService.getStores() });
});

router.get('/stores/:id', (req: Request, res: Response) => {
  const store = storeService.getStoreById(req.params.id);
  if (!store) {
    return res.status(404).json({ success: false, error: '门店不存在' });
  }
  res.json({ success: true, data: store });
});

router.post('/courses', (req: Request, res: Response) => {
  try {
    const { name, storeId, description, category } = req.body;
    if (!name || !storeId) {
      return res.status(400).json({ error: '课程名称和门店ID不能为空' });
    }
    const course = courseService.createCourse(name, storeId, description || '', category || '');
    res.json({ success: true, data: course });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/courses', (req: Request, res: Response) => {
  const { storeId } = req.query;
  let courses;
  if (storeId) {
    courses = courseService.getCoursesByStoreId(storeId as string);
  } else {
    courses = courseService.getCourses();
  }
  res.json({ success: true, data: courses });
});

router.get('/courses/:id', (req: Request, res: Response) => {
  const course = courseService.getCourseById(req.params.id);
  if (!course) {
    return res.status(404).json({ success: false, error: '课程不存在' });
  }
  res.json({ success: true, data: course });
});

router.post('/courses/:courseId/slots', (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { startTime, endTime, capacity } = req.body;
    if (!startTime || !endTime || !capacity) {
      return res.status(400).json({ error: '开始时间、结束时间和容量不能为空' });
    }
    const slot = courseSlotService.createCourseSlot(courseId, startTime, endTime, capacity);
    res.json({ success: true, data: slot });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/courses/:courseId/slots', (req: Request, res: Response) => {
  const slots = courseSlotService.getCourseSlotsByCourseId(req.params.courseId);
  res.json({ success: true, data: slots });
});

router.get('/slots/:id', (req: Request, res: Response) => {
  const slot = courseSlotService.getCourseSlotById(req.params.id);
  if (!slot) {
    return res.status(404).json({ success: false, error: '课程时间段不存在' });
  }
  res.json({ success: true, data: slot });
});

router.put('/slots/:id/enrolled', (req: Request, res: Response) => {
  try {
    const { enrolledCount } = req.body;
    if (enrolledCount === undefined) {
      return res.status(400).json({ success: false, error: '缺少 enrolledCount 参数' });
    }
    const slot = courseSlotService.setEnrolledCount(req.params.id, enrolledCount);
    if (!slot) {
      return res.status(404).json({ success: false, error: '课程时间段不存在' });
    }
    res.json({ success: true, data: slot });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/students', (req: Request, res: Response) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: '学员姓名和手机号不能为空' });
    }
    const student = studentService.getOrCreateStudent(name, phone);
    res.json({ success: true, data: student });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/students', (req: Request, res: Response) => {
  res.json({ success: true, data: studentService.getStudents() });
});

export default router;
