import { v4 as uuidv4 } from 'uuid';
import { repository } from '../repository';
import { WaitlistEntry, Notification, NotificationChannel, NotificationStatus, Student, Course, CourseSlot } from '../types';

export interface NotificationDetail extends Notification {
  remainingSeconds: number | null;
  isExpired: boolean;
  reminderCount: number;
}

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
      declinedAt: null,
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

  resendReminder(entryId: string): Notification | undefined {
    const entry = repository.getWaitlistEntryById(entryId);
    if (!entry) return undefined;

    if (entry.status !== 'notified') {
      throw new Error(`该候补当前状态为「${entry.status}」，仅「待确认」状态可重发提醒`);
    }

    if (entry.expireAt && new Date(entry.expireAt) < new Date()) {
      throw new Error('该补位邀请已超时，无法重发提醒');
    }

    const existingNotifications = repository.getNotificationsByWaitlistEntryId(entryId);
    const reminderCount = existingNotifications.filter(n => n.result === '系统重发提醒' || n.status === 'sent').length;
    if (reminderCount >= 2) {
      throw new Error('该邀请已重发过一次提醒，不可再次重发');
    }

    const student = repository.getStudentById(entry.studentId);
    const course = repository.getCourseById(entry.courseId);
    const slot = repository.getCourseSlotById(entry.slotId);
    const expireAt = entry.expireAt ? new Date(entry.expireAt) : new Date();
    const now = new Date();

    const message = this.buildReminderMessage(student, course, slot, expireAt);
    const config = repository.getConfig();
    const channel = config.notificationChannels[0] || 'app';

    const reminder: Notification = {
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
      declinedAt: null,
      expireAt: entry.expireAt,
      result: '系统重发提醒'
    };

    repository.addNotification(reminder);

    console.log(`[提醒已重发] 学员: ${student?.name}, 课程: ${course?.name}`);

    return reminder;
  }

  forceDecline(entryId: string): Notification | undefined {
    const entry = repository.getWaitlistEntryById(entryId);
    if (!entry) return undefined;

    if (entry.status !== 'notified') {
      throw new Error(`该候补当前状态为「${entry.status}」，仅「待确认」状态可手动结束邀请`);
    }

    const now = new Date();
    const notifications = repository.getNotificationsByWaitlistEntryId(entryId);

    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'declined';
        n.declinedAt = now.toISOString();
        n.result = '前台手动结束邀请，学员口头确认放弃';
        repository.updateNotification(n);
      }
    }

    const forceDeclineNotif: Notification = {
      id: uuidv4(),
      waitlistEntryId: entry.id,
      studentId: entry.studentId,
      courseId: entry.courseId,
      slotId: entry.slotId,
      channel: 'app',
      status: 'declined',
      message: '前台操作：手动结束补位邀请',
      sentAt: now.toISOString(),
      confirmedAt: null,
      declinedAt: now.toISOString(),
      expireAt: entry.expireAt,
      result: '前台手动结束邀请，学员口头确认放弃'
    };
    repository.addNotification(forceDeclineNotif);

    return forceDeclineNotif;
  }

  getNotificationDetail(id: string): NotificationDetail | undefined {
    const notification = repository.getNotificationById(id);
    if (!notification) return undefined;

    const allEntryNotifications = repository.getNotificationsByWaitlistEntryId(notification.waitlistEntryId);
    const reminderCount = allEntryNotifications.filter(n => n.result === '系统重发提醒').length;

    const now = new Date();
    let remainingSeconds: number | null = null;
    let isExpired = false;

    if (notification.expireAt) {
      const expireDate = new Date(notification.expireAt);
      const diff = expireDate.getTime() - now.getTime();
      remainingSeconds = Math.max(0, Math.floor(diff / 1000));
      if (diff <= 0) isExpired = true;
    }

    if (notification.status === 'confirmed' || notification.status === 'declined' || notification.status === 'expired') {
      remainingSeconds = null;
    }

    return {
      ...notification,
      remainingSeconds,
      isExpired,
      reminderCount
    };
  }

  getPendingNotificationsWithRemaining(): NotificationDetail[] {
    const allNotifications = repository.getNotifications();
    const now = new Date();

    return allNotifications
      .filter(n => n.status === 'sent')
      .map(n => {
        let remainingSeconds: number | null = null;
        let isExpired = false;
        if (n.expireAt) {
          const diff = new Date(n.expireAt).getTime() - now.getTime();
          remainingSeconds = Math.max(0, Math.floor(diff / 1000));
          if (diff <= 0) isExpired = true;
        }
        const allEntryNotifications = repository.getNotificationsByWaitlistEntryId(n.waitlistEntryId);
        const reminderCount = allEntryNotifications.filter(x => x.result === '系统重发提醒').length;

        return { ...n, remainingSeconds, isExpired, reminderCount };
      })
      .sort((a, b) => (a.remainingSeconds ?? Infinity) - (b.remainingSeconds ?? Infinity));
  }

  markConfirmedByWaitlistEntry(waitlistEntryId: string): void {
    const now = new Date().toISOString();
    const notifications = repository.getNotificationsByWaitlistEntryId(waitlistEntryId);
    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'confirmed';
        n.confirmedAt = now;
        n.result = '学员已确认补位成功';
        repository.updateNotification(n);
      }
    }
  }

  markExpiredByWaitlistEntry(waitlistEntryId: string): void {
    const notifications = repository.getNotificationsByWaitlistEntryId(waitlistEntryId);
    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'expired';
        n.result = '学员超时未确认，已顺延至下一位候补';
        repository.updateNotification(n);
      }
    }
  }

  markDeclinedByWaitlistEntry(waitlistEntryId: string): void {
    const now = new Date().toISOString();
    const notifications = repository.getNotificationsByWaitlistEntryId(waitlistEntryId);
    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'declined';
        n.declinedAt = now;
        n.result = '学员主动放弃补位，已顺延至下一位候补';
        repository.updateNotification(n);
      }
    }
  }

  markCancelledByWaitlistEntry(waitlistEntryId: string): void {
    const notifications = repository.getNotificationsByWaitlistEntryId(waitlistEntryId);
    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'expired';
        n.result = '学员主动取消候补队列';
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

  private buildReminderMessage(student: Student | undefined, course: Course | undefined, slot: CourseSlot | undefined, expireAt: Date): string {
    const formatDate = (iso: string) => {
      try {
        return new Date(iso).toLocaleString('zh-CN');
      } catch { return iso; }
    };

    const now = new Date();
    const remainingMinutes = Math.max(0, Math.floor((expireAt.getTime() - now.getTime()) / 60000));

    return `【补位提醒】尊敬的${student?.name || '学员'}，您候补的课程「${course?.name || ''}」(${slot ? formatDate(slot.startTime) + ' - ' + formatDate(slot.endTime) : ''})的补位邀请即将过期！剩余确认时间约${remainingMinutes}分钟，请尽快确认，逾期将顺延至下一位学员。`;
  }
}
