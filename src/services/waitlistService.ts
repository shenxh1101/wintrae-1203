import { v4 as uuidv4 } from 'uuid';
import { repository } from '../repository';
import {
  Student, Course, CourseSlot, WaitlistEntry, Notification,
  WaitlistStatus, NotificationStatus, NotificationChannel
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
}

export class WaitlistService {
  private slotService: any;
  private notificationService: INotificationService;

  constructor(slotService: any, notificationService: INotificationService) {
    this.slotService = slotService;
    this.notificationService = notificationService;
  }

  joinWaitlist(
    student: Student,
    course: Course,
    slot: CourseSlot
  ): WaitlistEntry {
    const config = repository.getConfig();

    if (this.slotService.hasAvailableSlot(slot.id)) {
      throw new Error('该课程时间段目前有名额，可直接报名无需候补');
    }

    const activeCount = repository.getActiveWaitlistCountByStudentId(student.id);
    if (activeCount >= config.maxWaitlistPerStudent) {
      throw new Error(`每位学员最多只能候补 ${config.maxWaitlistPerStudent} 个课程`);
    }

    const existingActive = repository.getActiveWaitlistBySlotId(slot.id)
      .find(e => e.studentId === student.id);
    if (existingActive) {
      throw new Error('您已在该课程时间段的候补队列中');
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
      expireAt: null
    };

    repository.addWaitlistEntry(entry);
    return entry;
  }

  cancelWaitlist(entryId: string): WaitlistEntry | undefined {
    const entry = repository.getWaitlistEntryById(entryId);
    if (!entry) return undefined;

    if (entry.status === 'cancelled' || entry.status === 'confirmed' || entry.status === 'enrolled' || entry.status === 'expired') {
      throw new Error('该候补状态不可取消');
    }

    entry.status = 'cancelled';
    entry.cancelledAt = new Date().toISOString();
    repository.updateWaitlistEntry(entry);

    this.rebalanceQueue(entry.slotId);
    return entry;
  }

  confirmWaitlist(entryId: string): WaitlistEntry | undefined {
    const entry = repository.getWaitlistEntryById(entryId);
    if (!entry) return undefined;

    if (entry.status !== 'notified') {
      throw new Error('只有已通知的候补才能确认');
    }

    if (entry.expireAt && new Date(entry.expireAt) < new Date()) {
      entry.status = 'expired';
      repository.updateWaitlistEntry(entry);
      this.rebalanceQueue(entry.slotId);
      throw new Error('确认已超时，候补资格已顺延至下一位');
    }

    entry.status = 'confirmed';
    entry.confirmedAt = new Date().toISOString();
    repository.updateWaitlistEntry(entry);

    this.notificationService.markConfirmedByWaitlistEntry(entryId);
    this.slotService.incrementEnrolled(entry.slotId);

    return entry;
  }

  releaseSlot(slotId: string, count: number = 1): Notification[] {
    const slot = repository.getCourseSlotById(slotId);
    if (!slot) {
      throw new Error('课程时间段不存在');
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
    const config = repository.getConfig();
    const timeoutMs = config.notificationTimeoutMinutes * 60 * 1000;

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

  private rebalanceQueue(slotId: string): void {
    const waitingEntries = repository.getWaitingWaitlistBySlotId(slotId);
    waitingEntries.forEach((entry, idx) => {
      entry.queuePosition = idx + 1;
      repository.updateWaitlistEntry(entry);
    });
  }

  private calculateTurnoverRate(slotId: string): number {
    const entries = repository.getWaitlistBySlotId(slotId);
    const completed = entries.filter(e => e.status === 'confirmed' || e.status === 'enrolled' || e.status === 'expired');
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
}
