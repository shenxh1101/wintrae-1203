import { StoreService, CourseService, CourseSlotService, StudentService } from './basicServices';
import { WaitlistService } from './waitlistService';
import { NotificationService } from './notificationService';
import { StatisticsService } from './statisticsService';

const storeService = new StoreService();
const courseService = new CourseService();
const courseSlotService = new CourseSlotService();
const studentService = new StudentService();
const notificationService = new NotificationService();
const waitlistService = new WaitlistService(courseSlotService, courseService, notificationService);
const statisticsService = new StatisticsService();

export {
  storeService,
  courseService,
  courseSlotService,
  studentService,
  notificationService,
  waitlistService,
  statisticsService
};
