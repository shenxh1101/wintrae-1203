import { v4 as uuidv4 } from 'uuid';
import { repository } from '../repository';
import {
  WaitlistEntry, Notification, NotificationChannel, NotificationStatus,
  Student, Course, CourseSlot, NotificationLedgerRow, NotificationTimelineItem,
  ReleaseChainLedger, ReleaseChainStep
} from '../types';

export interface NotificationDetail extends Notification {
  remainingSeconds: number | null;
  isExpired: boolean;
  reminderCount: number;
}

export class NotificationService {
  sendNotification(entry: WaitlistEntry, releaseGroupId?: string, chainOrder?: number): Notification {
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
      result: null,
      releaseGroupId: releaseGroupId || null,
      chainOrder: chainOrder || null
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
    const reminderCount = existingNotifications.filter(n => n.result === '系统重发提醒').length;
    if (reminderCount >= 1) {
      throw new Error('该邀请已重发过一次提醒，不可再次重发');
    }

    const firstInvite = existingNotifications.find(n => n.releaseGroupId);
    const releaseGroupId = firstInvite?.releaseGroupId || null;
    const chainOrder = firstInvite?.chainOrder || null;

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
      result: '系统重发提醒',
      releaseGroupId,
      chainOrder
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

    const existingForEntry = repository.getNotificationsByWaitlistEntryId(entry.id);
    const firstInvite = existingForEntry.find(n => n.releaseGroupId);
    const releaseGroupId = firstInvite?.releaseGroupId || null;
    const chainOrder = firstInvite?.chainOrder || null;

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
      result: '前台手动结束邀请，学员口头确认放弃',
      releaseGroupId,
      chainOrder
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
        if (n.result !== '系统重发提醒') {
          n.result = '学员已确认补位成功';
        }
        repository.updateNotification(n);
      }
    }
  }

  markExpiredByWaitlistEntry(waitlistEntryId: string): void {
    const notifications = repository.getNotificationsByWaitlistEntryId(waitlistEntryId);
    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'expired';
        if (n.result !== '系统重发提醒') {
          n.result = '学员超时未确认，已顺延至下一位候补';
        }
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
        if (n.result !== '系统重发提醒') {
          n.result = '学员主动放弃补位，已顺延至下一位候补';
        }
        repository.updateNotification(n);
      }
    }
  }

  markCancelledByWaitlistEntry(waitlistEntryId: string): void {
    const notifications = repository.getNotificationsByWaitlistEntryId(waitlistEntryId);
    for (const n of notifications) {
      if (n.status === 'sent' || n.status === 'pending') {
        n.status = 'expired';
        if (n.result !== '系统重发提醒') {
          n.result = '学员主动取消候补队列';
        }
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

  getNotificationLedger(
    storeId?: string,
    courseId?: string,
    dateFrom?: string,
    dateTo?: string
  ): NotificationLedgerRow[] {
    const stores = repository.getStores();
    const courses = repository.getCourses();
    const slots = repository.getCourseSlots();
    const students = repository.getStudents();
    const entries = repository.getWaitlistEntries();
    const notifications = repository.getNotifications();

    const courseToStore = new Map(courses.map(c => [c.id, c.storeId]));

    let validSlotIds: Set<string> | null = null;
    if (storeId || courseId) {
      validSlotIds = new Set<string>();
      for (const slot of slots) {
        if (courseId && slot.courseId !== courseId) continue;
        const sId = courseToStore.get(slot.courseId);
        if (storeId && sId !== storeId) continue;
        validSlotIds.add(slot.id);
      }
    }

    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;
    if (toDate) toDate.setDate(toDate.getDate() + 1);

    const result: NotificationLedgerRow[] = [];

    for (const entry of entries) {
      if (validSlotIds && !validSlotIds.has(entry.slotId)) continue;

      const firstNotifiedAt = entry.notifiedAt;
      if (fromDate && firstNotifiedAt && new Date(firstNotifiedAt) < fromDate) continue;
      if (toDate && firstNotifiedAt && new Date(firstNotifiedAt) >= toDate) continue;

      const entryNotifications = notifications.filter(n => n.waitlistEntryId === entry.id);
      if (entryNotifications.length === 0) continue;

      const student = students.find(s => s.id === entry.studentId);
      const course = courses.find(c => c.id === entry.courseId);
      const store = stores.find(s => s.id === course?.storeId);
      const slot = slots.find(s => s.id === entry.slotId);

      const timeline: NotificationTimelineItem[] = [];
      const sortedNotifs = [...entryNotifications].sort((a, b) =>
        (a.sentAt || '').localeCompare(b.sentAt || '')
      );

      for (const n of sortedNotifs) {
        let type: 'invite' | 'reminder' | 'result' = 'result';
        if (n.result === '系统重发提醒') type = 'reminder';
        else if (n.result === null && n.status === 'sent') type = 'invite';

        timeline.push({
          id: n.id,
          type,
          status: n.status,
          sentAt: n.sentAt || '',
          result: n.result,
          message: n.message
        });
      }

      const reminderCount = entryNotifications.filter(n => n.result === '系统重发提醒').length;
      const finalNotif = sortedNotifs[sortedNotifs.length - 1];
      const finalResult = finalNotif?.result || null;
      const finalResultAt = finalNotif?.declinedAt || finalNotif?.confirmedAt || finalNotif?.sentAt || null;

      const now = new Date();
      let remainingSeconds: number | null = null;
      let isExpired = false;
      if (entry.status === 'notified' && entry.expireAt) {
        const diff = new Date(entry.expireAt).getTime() - now.getTime();
        remainingSeconds = Math.max(0, Math.floor(diff / 1000));
        if (diff <= 0) isExpired = true;
      }

      result.push({
        waitlistEntryId: entry.id,
        studentId: entry.studentId,
        studentName: student?.name || '',
        studentPhone: student?.phone || '',
        courseId: entry.courseId,
        courseName: course?.name || '',
        storeId: store?.id || '',
        storeName: store?.name || '',
        slotId: entry.slotId,
        slotStartTime: slot?.startTime || '',
        slotEndTime: slot?.endTime || '',
        entryStatus: entry.status,
        firstNotifiedAt,
        finalResultAt,
        finalResult,
        reminderCount,
        remainingSeconds,
        isExpired,
        timeline
      });
    }

    return result.sort((a, b) =>
      (b.firstNotifiedAt || '').localeCompare(a.firstNotifiedAt || '')
    );
  }

  getReleaseChainLedger(
    storeId?: string,
    courseId?: string,
    dateFrom?: string,
    dateTo?: string
  ): ReleaseChainLedger[] {
    const stores = repository.getStores();
    const courses = repository.getCourses();
    const slots = repository.getCourseSlots();
    const students = repository.getStudents();
    const notifications = repository.getNotifications();

    const courseToStore = new Map(courses.map(c => [c.id, c.storeId]));

    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;
    if (toDate) toDate.setDate(toDate.getDate() + 1);

    const byGroup = new Map<string, Notification[]>();
    for (const n of notifications) {
      if (!n.releaseGroupId) continue;
      if (!byGroup.has(n.releaseGroupId)) byGroup.set(n.releaseGroupId, []);
      byGroup.get(n.releaseGroupId)!.push(n);
    }

    const results: ReleaseChainLedger[] = [];

    for (const [releaseGroupId, groupNotifs] of byGroup) {
      const inviteNotifs = groupNotifs
        .filter(n => n.result !== '系统重发提醒')
        .sort((a, b) => (a.chainOrder || 0) - (b.chainOrder || 0));
      if (inviteNotifs.length === 0) continue;

      const firstInvite = inviteNotifs[0];
      const slot = slots.find(s => s.id === firstInvite.slotId);
      const course = courses.find(c => c.id === firstInvite.courseId);
      const store = stores.find(s => s.id === course?.storeId);

      if (storeId && store?.id !== storeId) continue;
      if (courseId && course?.id !== courseId) continue;
      if (fromDate && firstInvite.sentAt && new Date(firstInvite.sentAt) < fromDate) continue;
      if (toDate && firstInvite.sentAt && new Date(firstInvite.sentAt) >= toDate) continue;

      const firstInviteSentAt = firstInvite.sentAt;
      const releasedCount = new Set(inviteNotifs.map(n => n.chainOrder)).size;

      const byChain = new Map<number, Notification[]>();
      for (const n of groupNotifs) {
        const order = n.chainOrder || 0;
        if (!byChain.has(order)) byChain.set(order, []);
        byChain.get(order)!.push(n);
      }

      const steps: ReleaseChainStep[] = [];
      let finalWinnerStudentId: string | null = null;
      let finalWinnerStudentName: string | null = null;
      let totalForwardCount = 0;

      const orders = Array.from(byChain.keys()).sort((a, b) => a - b);
      for (const order of orders) {
        const chainNotifs = byChain.get(order)!;
        const invite = chainNotifs.find(n => n.result !== '系统重发提醒') || chainNotifs[0];
        const reminders = chainNotifs.filter(n => n.result === '系统重发提醒');

        const student = students.find(s => s.id === invite.studentId);
        const entry = repository.getWaitlistEntryById(invite.waitlistEntryId);

        let finalResult: ReleaseChainStep['finalResult'] = null;
        let finalResultAt: string | null = null;
        let resultMessage: string | null = null;

        if (entry) {
          switch (entry.status) {
            case 'confirmed':
              finalResult = 'confirmed';
              finalResultAt = entry.confirmedAt;
              resultMessage = '学员确认补位成功';
              finalWinnerStudentId = student?.id || null;
              finalWinnerStudentName = student?.name || null;
              break;
            case 'declined':
              finalResult = 'declined';
              finalResultAt = entry.declinedAt;
              resultMessage = '学员主动放弃';
              totalForwardCount++;
              break;
            case 'expired':
              finalResult = 'expired';
              finalResultAt = invite.expireAt;
              resultMessage = '超时未确认';
              totalForwardCount++;
              break;
            case 'rescheduled':
              finalResult = 'manual_ended';
              finalResultAt = entry.rescheduledAt;
              resultMessage = '学员改期，顺延下一位';
              totalForwardCount++;
              break;
            case 'cancelled':
              finalResult = 'manual_ended';
              finalResultAt = entry.cancelledAt;
              resultMessage = '前台手动结束';
              totalForwardCount++;
              break;
            case 'notified':
              finalResult = 'pending';
              resultMessage = '待学员确认';
              break;
          }
        }

        steps.push({
          order,
          waitlistEntryId: invite.waitlistEntryId,
          studentId: invite.studentId,
          studentName: student?.name || '',
          studentPhone: student?.phone || '',
          firstNotificationSentAt: invite.sentAt,
          finalResult,
          finalResultAt,
          resultMessage,
          reminders: reminders.map(r => ({
            notificationId: r.id,
            sentAt: r.sentAt
          }))
        });
      }

      let finalStatus: ReleaseChainLedger['finalStatus'] = 'in_progress';
      const lastStep = steps[steps.length - 1];
      if (lastStep) {
        if (lastStep.finalResult === 'confirmed') {
          finalStatus = 'filled';
        } else if (lastStep.finalResult !== null && lastStep.finalResult !== 'pending') {
          finalStatus = 'partially_filled';
        }
      }

      results.push({
        releaseGroupId,
        storeId: store?.id || '',
        storeName: store?.name || '',
        courseId: course?.id || '',
        courseName: course?.name || '',
        slotId: slot?.id || '',
        slotStartTime: slot?.startTime || '',
        slotEndTime: slot?.endTime || '',
        releasedAt: firstInviteSentAt || '',
        releasedCount,
        steps,
        totalForwardCount,
        finalStatus,
        finalWinnerStudentId,
        finalWinnerStudentName
      });
    }

    return results.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  }

  getPendingNotificationsDeduped(): NotificationDetail[] {
    const all = this.getPendingNotificationsWithRemaining();
    const seen = new Map<string, NotificationDetail>();

    for (const n of all) {
      const existing = seen.get(n.waitlistEntryId);
      if (!existing) {
        seen.set(n.waitlistEntryId, n);
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => (a.remainingSeconds ?? Infinity) - (b.remainingSeconds ?? Infinity));
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
