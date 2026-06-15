import { v4 as uuidv4 } from 'uuid';
import { repository } from '../repository';
import { WaitlistEntry, Notification, NotificationChannel, NotificationStatus, Student, Course, CourseSlot } from '../types';

export class NotificationService {
  sendNotification(entry: WaitlistEntry): Notification {
    const config = repository.getConfig();
    const now = new Date();
    const expireAt = new Date(now.getTime() + config.notificationTimeoutMinutes * 60 * 1000);

    const student = repository.getStudentById(entry.studentId);
    const course = repository.getCourseById(entry.courseId);
    const slot = repository.getCourseSlotById(entry.slotId);

    const message = this.buildMessage(student, course, slot, expireAt);
    const channel = config.notificationChannels[0] || 'app';

    const notification: Notification = {
      id: uuidv4(),
      waitlistEntryId: entry.id,
      studentId: entry.studentId,
      courseId: entry.courseId,
      slotId: entry.slotId,
      channel,
      status: 'sent',
      message,
      sentAt: now.toISOString(),
      confirmedAt: null,
      expireAt: expireAt.toISOString(),
      result: null
    };

    repository.addNotification(notification);

    entry.status = 'notified';
    entry.notifiedAt = now.toISOString();
    entry.expireAt = expireAt.toISOString();
    repository.updateWaitlistEntry(entry);

    console.log(`[通知已发送] 学员: ${student?.name}, 课程: ${course?.name}, 渠道: ${channel}, 过期时间: ${expireAt.toLocaleString()}`);

    return notification;
  }

  markConfirmedByWaitlistEntry(waitlistEntryId: string): void {
    const notifications = repository.getNotificationsByWaitlistEntryId(waitlistEntryId);
    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'confirmed';
        n.confirmedAt = new Date().toISOString();
        n.result = '学员已确认';
        repository.updateNotification(n);
      }
    }
  }

  markExpiredByWaitlistEntry(waitlistEntryId: string): void {
    const notifications = repository.getNotificationsByWaitlistEntryId(waitlistEntryId);
    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'expired';
        n.result = '确认超时，已顺延至下一位候补';
        repository.updateNotification(n);
      }
    }
  }

  getNotificationById(id: string): Notification | undefined {
    return repository.getNotificationById(id);
  }

  getNotificationsByStudentId(studentId: string): Notification[] {
    return repository.getNotificationsByStudentId(studentId);
  }

  getNotificationsByWaitlistEntryId(entryId: string): Notification[] {
    return repository.getNotificationsByWaitlistEntryId(entryId);
  }

  getAllNotifications(): Notification[] {
    return repository.getNotifications();
  }

  private buildMessage(student: Student | undefined, course: Course | undefined, slot: CourseSlot | undefined, expireAt: Date): string {
    const formatDate = (iso: string) => {
      try {
        return new Date(iso).toLocaleString('zh-CN');
      } catch { return iso; }
    };

    return `【候补补位通知】尊敬的${student?.name || '学员'}，您候补的课程「${course?.name || ''}」(${slot ? formatDate(slot.startTime) + ' - ' + formatDate(slot.endTime) : ''})有名额释放！请于${expireAt.toLocaleString('zh-CN')}前确认，逾期将顺延至下一位学员。`;
  }
}
