import { v4 as uuidv4 } from 'uuid';
import { repository } from '../repository';
import {
  Student, Course, CourseSlot, WaitlistEntry, Notification, WaitlistRescheduleResult
} from '../types';

export interface WaitlistPositionInfo {
  entry: WaitlistEntry;
  position: number;
  totalWaiting: number;
  estimatedChance: number;
  notifications: Notification[];
}

interface INotificationService {
  sendNotification(entry: WaitlistEntry): Notification;
  markConfirmedByWaitlistEntry(waitlistEntryId: string): void;
  markExpiredByWaitlistEntry(waitlistEntryId: string): void;
  markDeclinedByWaitlistEntry(waitlistEntryId: string): void;
  markCancelledByWaitlistEntry(waitlistEntryId: string): void;
}

export class WaitlistService {
  private slotService: any;
  private courseService: any;
  private notificationService: INotificationService;

  constructor(slotService: any, courseService: any, notificationService: INotificationService) {
    this.slotService = slotService;
    this.courseService = courseService;
    this.notificationService = notificationService;
  }

  joinWaitlist(
    student: Student,
    course: Course,
    slot: CourseSlot
  ): WaitlistEntry {
    if (slot.courseId !== course.id) {
      throw new Error(`参数不匹配：该时间段（slotId=${slot.id}）不属于课程「${course.name}」(courseId=${course.id})，请检查 courseId 与 slotId 是否对应`);
    }

    const config = repository.getConfig();

    if (this.slotService.hasAvailableSlot(slot.id)) {
      throw new Error('该课程时间段目前有名额，可直接报名无需候补');
    }

    const activeCount = repository.getActiveWaitlistCountByStudentId(student.id);
    if (activeCount >= config.maxWaitlistPerStudent) {
      throw new Error(`每位学员最多只能候补 ${config.maxWaitlistPerStudent} 个课程，您当前已有 ${activeCount} 个有效候补`);
    }

    const existingActive = repository.getActiveWaitlistBySlotId(slot.id)
      .find(e => e.studentId === student.id);
    if (existingActive) {
      throw new Error(`您已在该课程时间段的候补队列中（候补ID：${existingActive.id}，当前排位：${existingActive.queuePosition}）`);
    }

    const waitingEntries = repository.getWaitingWaitlistBySlotId(slot.id);
    const nextPosition = waitingEntries.length + 1;

    const entry: WaitlistEntry = {
      id: uuidv4(),
      studentId: student.id,
      courseId: course.id,
      slotId: slot.id,
      status: 'waiting',
      queuePosition: nextPosition,
      joinedAt: new Date().toISOString(),
      notifiedAt: null,
      confirmedAt: null,
      cancelledAt: null,
      declinedAt: null,
      rescheduledAt: null,
      rescheduledToEntryId: null,
      rescheduledFromEntryId: null,
      expireAt: null
    };

    repository.addWaitlistEntry(entry);
    return entry;
  }

  cancelWaitlist(entryId: string): WaitlistEntry | undefined {
    const entry = repository.getWaitlistEntryById(entryId);
    if (!entry) return undefined;

    if (entry.status === 'cancelled' || entry.status === 'confirmed' || entry.status === 'enrolled' || entry.status === 'expired' || entry.status === 'declined' || entry.status === 'rescheduled') {
      throw new Error(`该候补当前状态为「${this.statusLabel(entry.status)}」，不可取消`);
    }

    entry.status = 'cancelled';
    entry.cancelledAt = new Date().toISOString();
    repository.updateWaitlistEntry(entry);

    this.notificationService.markCancelledByWaitlistEntry(entryId);
    this.rebalanceQueue(entry.slotId);
    return entry;
  }

  declineWaitlist(entryId: string): WaitlistEntry | undefined {
    const entry = repository.getWaitlistEntryById(entryId);
    if (!entry) return undefined;

    if (entry.status !== 'notified') {
      if (entry.status === 'waiting') {
        throw new Error('该候补尚未收到补位邀请，如需退出请使用「取消候补」功能');
      }
      throw new Error(`该候补当前状态为「${this.statusLabel(entry.status)}」，不可执行放弃操作`);
    }

    entry.status = 'declined';
    entry.declinedAt = new Date().toISOString();
    repository.updateWaitlistEntry(entry);

    this.notificationService.markDeclinedByWaitlistEntry(entryId);
    this.rebalanceQueue(entry.slotId);
    this.notifyNextInQueue(entry.slotId, 1);

    return entry;
  }

  confirmWaitlist(entryId: string): WaitlistEntry | undefined {
    const entry = repository.getWaitlistEntryById(entryId);
    if (!entry) return undefined;

    if (entry.status !== 'notified') {
      if (entry.status === 'waiting') {
        throw new Error('该候补尚未收到补位邀请，请耐心等待通知');
      }
      throw new Error(`该候补当前状态为「${this.statusLabel(entry.status)}」，不可执行确认操作`);
    }

    if (entry.expireAt && new Date(entry.expireAt) < new Date()) {
      entry.status = 'expired';
      repository.updateWaitlistEntry(entry);
      this.notificationService.markExpiredByWaitlistEntry(entry.id);
      this.rebalanceQueue(entry.slotId);
      this.notifyNextInQueue(entry.slotId, 1);
      throw new Error('确认已超时，候补资格已顺延至下一位学员');
    }

    entry.status = 'confirmed';
    entry.confirmedAt = new Date().toISOString();
    repository.updateWaitlistEntry(entry);

    this.notificationService.markConfirmedByWaitlistEntry(entryId);
    this.slotService.incrementEnrolled(entry.slotId);
    this.rebalanceQueue(entry.slotId);

    return entry;
  }

  rescheduleWaitlist(entryId: string, newSlotId: string): WaitlistRescheduleResult | undefined {
    const oldEntry = repository.getWaitlistEntryById(entryId);
    if (!oldEntry) return undefined;

    if (oldEntry.status !== 'waiting' && oldEntry.status !== 'notified') {
      throw new Error(`该候补当前状态为「${this.statusLabel(oldEntry.status)}」，仅「排队中」和「待确认」的候补可改期`);
    }

    const newSlot = repository.getCourseSlotById(newSlotId);
    if (!newSlot) {
      throw new Error(`目标时间段不存在（slotId=${newSlotId}）`);
    }

    if (newSlot.courseId !== oldEntry.courseId) {
      throw new Error(`改期失败：目标时间段不属于同一门课程。原课程ID=${oldEntry.courseId}，目标时间段所属课程ID=${newSlot.courseId}`);
    }

    if (newSlot.id === oldEntry.slotId) {
      throw new Error('改期失败：目标时间段与当前候补时间段相同');
    }

    if (this.slotService.hasAvailableSlot(newSlot.id)) {
      throw new Error('目标时间段目前有名额，可直接报名无需候补');
    }

    const student = repository.getStudentById(oldEntry.studentId);
    if (!student) {
      throw new Error('学员信息不存在');
    }

    const existingActive = repository.getActiveWaitlistBySlotId(newSlot.id)
      .find(e => e.studentId === student.id);
    if (existingActive) {
      throw new Error(`您已在目标时间段的候补队列中（候补ID：${existingActive.id}）`);
    }

    const wasNotified = oldEntry.status === 'notified';
    oldEntry.status = 'rescheduled';
    oldEntry.rescheduledAt = new Date().toISOString();
    repository.updateWaitlistEntry(oldEntry);

    if (wasNotified) {
      this.notificationService.markDeclinedByWaitlistEntry(oldEntry.id);
    } else {
      this.notificationService.markCancelledByWaitlistEntry(oldEntry.id);
    }
    this.rebalanceQueue(oldEntry.slotId);

    if (wasNotified) {
      this.notifyNextInQueue(oldEntry.slotId, 1);
    }

    const waitingEntries = repository.getWaitingWaitlistBySlotId(newSlot.id);
    const nextPosition = waitingEntries.length + 1;

    const newEntry: WaitlistEntry = {
      id: uuidv4(),
      studentId: student.id,
      courseId: oldEntry.courseId,
      slotId: newSlot.id,
      status: 'waiting',
      queuePosition: nextPosition,
      joinedAt: new Date().toISOString(),
      notifiedAt: null,
      confirmedAt: null,
      cancelledAt: null,
      declinedAt: null,
      rescheduledAt: null,
      rescheduledToEntryId: null,
      rescheduledFromEntryId: oldEntry.id,
      expireAt: null
    };
    repository.addWaitlistEntry(newEntry);

    oldEntry.rescheduledToEntryId = newEntry.id;
    repository.updateWaitlistEntry(oldEntry);

    const positionInfo = this.getWaitlistPosition(newEntry.id);

    return {
      oldEntry,
      newEntry,
      newPositionInfo: {
        position: positionInfo?.position ?? nextPosition,
        totalWaiting: positionInfo?.totalWaiting ?? nextPosition,
        estimatedChance: positionInfo?.estimatedChance ?? 0
      }
    };
  }

  releaseSlot(slotId: string, count: number = 1): Notification[] {
    const slot = repository.getCourseSlotById(slotId);
    if (!slot) {
      throw new Error(`课程时间段不存在（slotId=${slotId}）`);
    }

    if (!Number.isInteger(count) || count <= 0) {
      throw new Error(`释放数量非法：count=${count}，请传入大于 0 的整数`);
    }

    if (count > slot.enrolledCount) {
      throw new Error(`释放数量超过当前已报名人数：当前已报名 ${slot.enrolledCount} 人，请求释放 ${count} 人`);
    }

    this.slotService.decrementEnrolled(slotId, count);
    return this.notifyNextInQueue(slotId, count);
  }

  notifyNextInQueue(slotId: string, count: number = 1): Notification[] {
    const notifications: Notification[] = [];
    let remaining = count;

    while (remaining > 0) {
      const waitingEntries = repository.getWaitingWaitlistBySlotId(slotId);
      if (waitingEntries.length === 0) break;

      const nextEntry = waitingEntries[0];
      const notification = this.notificationService.sendNotification(nextEntry);
      notifications.push(notification);
      remaining--;
    }

    return notifications;
  }

  checkExpiredNotifications(): void {
    const now = new Date();
    const activeEntries = repository.getWaitlistEntries()
      .filter(e => e.status === 'notified' && e.expireAt);

    for (const entry of activeEntries) {
      if (entry.expireAt && new Date(entry.expireAt) < now) {
        entry.status = 'expired';
        repository.updateWaitlistEntry(entry);

        this.notificationService.markExpiredByWaitlistEntry(entry.id);
        this.rebalanceQueue(entry.slotId);
        this.notifyNextInQueue(entry.slotId, 1);
      }
    }
  }

  getWaitlistPosition(entryId: string): WaitlistPositionInfo | undefined {
    const entry = repository.getWaitlistEntryById(entryId);
    if (!entry) return undefined;

    const waitingEntries = repository.getWaitingWaitlistBySlotId(entry.slotId);
    const notifications = repository.getNotificationsByWaitlistEntryId(entryId);

    let position: number;
    if (entry.status === 'waiting') {
      position = entry.queuePosition;
    } else {
      position = -1;
    }

    const slot = repository.getCourseSlotById(entry.slotId);
    const turnoverRate = this.calculateTurnoverRate(entry.slotId);
    const estimatedChance = this.calculateEstimatedChance(position, waitingEntries.length, slot?.capacity || 0, turnoverRate);

    return {
      entry,
      position,
      totalWaiting: waitingEntries.length,
      estimatedChance,
      notifications
    };
  }

  getStudentWaitlist(studentId: string): WaitlistEntry[] {
    return repository.getWaitlistByStudentId(studentId);
  }

  getSlotWaitlist(slotId: string): WaitlistEntry[] {
    return repository.getWaitlistBySlotId(slotId);
  }

  batchRescheduleWaitlist(
    entryIds: string[],
    newSlotId: string
  ): { results: WaitlistRescheduleResult[]; failedItems: { entryId: string; error: string }[] } {
    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      throw new Error('entryIds 不能为空，请提供至少一个候补记录ID');
    }

    const newSlot = repository.getCourseSlotById(newSlotId);
    if (!newSlot) {
      throw new Error(`目标时间段不存在（slotId=${newSlotId}）`);
    }

    const results: WaitlistRescheduleResult[] = [];
    const failedItems: { entryId: string; error: string }[] = [];

    for (const entryId of entryIds) {
      try {
        const result = this.rescheduleWaitlist(entryId, newSlotId);
        if (result) {
          results.push(result);
        } else {
          failedItems.push({ entryId, error: '候补记录不存在' });
        }
      } catch (err: any) {
        failedItems.push({ entryId, error: err.message });
      }
    }

    return { results, failedItems };
  }

  private rebalanceQueue(slotId: string): void {
    const waitingEntries = repository.getWaitingWaitlistBySlotId(slotId);
    waitingEntries.forEach((entry, idx) => {
      entry.queuePosition = idx + 1;
      repository.updateWaitlistEntry(entry);
    });
  }

  private calculateTurnoverRate(slotId: string): number {
    const entries = repository.getWaitlistBySlotId(slotId);
    const completed = entries.filter(e => e.status === 'confirmed' || e.status === 'enrolled' || e.status === 'expired' || e.status === 'declined');
    if (completed.length === 0) return 0.3;
    const confirmed = completed.filter(e => e.status === 'confirmed' || e.status === 'enrolled');
    return confirmed.length / completed.length;
  }

  private calculateEstimatedChance(position: number, totalWaiting: number, capacity: number, turnoverRate: number): number {
    if (position <= 0 || totalWaiting === 0) return 0;
    if (position <= Math.ceil(capacity * turnoverRate * 0.5)) return 90;
    if (position <= Math.ceil(capacity * turnoverRate)) return 70;
    if (position <= totalWaiting / 2) return 40;
    return 15;
  }

  private statusLabel(status: string): string {
    const map: Record<string, string> = {
      waiting: '排队中',
      notified: '待确认',
      confirmed: '补位成功',
      enrolled: '已报名',
      cancelled: '已取消',
      expired: '已超时',
      declined: '主动放弃',
      rescheduled: '已改期'
    };
    return map[status] || status;
  }
}
