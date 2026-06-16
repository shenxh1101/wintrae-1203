import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import routes from './routes';
import { waitlistService } from './services';

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '课程候补与补位通知服务',
    version: '1.0.0',
    description: '线下培训机构热门课程候补与补位通知后端服务',
    endpoints: {
      health: '/api/health',
      basic: {
        stores: '/api/basic/stores',
        courses: '/api/basic/courses',
        slots: '/api/basic/slots/:id',
        students: '/api/basic/students'
      },
      waitlist: {
        join: 'POST /api/waitlist/join',
        cancel: 'POST /api/waitlist/:entryId/cancel',
        decline: 'POST /api/waitlist/:entryId/decline',
        confirm: 'POST /api/waitlist/:entryId/confirm',
        reschedule: 'POST /api/waitlist/:entryId/reschedule',
        batchReschedulePreview: 'POST /api/waitlist/batch-reschedule/preview',
        batchReschedule: 'POST /api/waitlist/batch-reschedule',
        release: 'POST /api/waitlist/slots/:slotId/release',
        position: 'GET /api/waitlist/entries/:entryId/position',
        studentEntries: 'GET /api/waitlist/students/:studentId/entries',
        slotEntries: 'GET /api/waitlist/slots/:slotId/entries',
        checkExpired: 'POST /api/waitlist/check-expired'
      },
      notifications: {
        list: 'GET /api/notifications',
        byId: 'GET /api/notifications/:id',
        detail: 'GET /api/notifications/:id/detail',
        byStudent: 'GET /api/notifications/students/:studentId',
        byWaitlist: 'GET /api/notifications/waitlist/:entryId',
        pending: 'GET /api/notifications/pending?dedup=true',
        ledger: 'GET /api/notifications/ledger?storeId=&courseId=&dateFrom=&dateTo=',
        resendReminder: 'POST /api/notifications/waitlist/:entryId/resend-reminder',
        forceDecline: 'POST /api/notifications/waitlist/:entryId/force-decline'
      },
      statistics: {
        courseHeatRank: 'GET /api/statistics/course-heat-rank',
        storeConversions: 'GET /api/statistics/store-conversions',
        overview: 'GET /api/statistics/overview',
        operationDashboard: 'GET /api/statistics/operation-dashboard?storeId=&courseId=&slotId=&dateFrom=&dateTo=',
        dailyTrend: 'GET /api/statistics/daily-trend?dateFrom=&dateTo='
      }
    }
  });
});

const startExpiryChecker = () => {
  setInterval(() => {
    try {
      waitlistService.checkExpiredNotifications();
    } catch (err) {
      console.error('超时检查失败:', err);
    }
  }, 60 * 1000);
};

app.listen(PORT, () => {
  console.log(`\n=========================================================`);
  console.log(`  课程候补与补位通知服务已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API 文档: http://localhost:${PORT}/`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`=========================================================\n`);
  startExpiryChecker();
});

export default app;
