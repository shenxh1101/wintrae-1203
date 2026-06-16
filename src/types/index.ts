export interface Store {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

export interface Course {
  id: string;
  name: string;
  storeId: string;
  description: string;
  category: string;
  createdAt: string;
}

export interface CourseSlot {
  id: string;
  courseId: string;
  startTime: string;
  endTime: string;
  capacity: number;
  enrolledCount: number;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export type WaitlistStatus = 'waiting' | 'notified' | 'confirmed' | 'cancelled' | 'expired' | 'enrolled' | 'declined' | 'rescheduled';

export interface WaitlistEntry {
  id: string;
  studentId: string;
  courseId: string;
  slotId: string;
  status: WaitlistStatus;
  queuePosition: number;
  joinedAt: string;
  notifiedAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  declinedAt: string | null;
  rescheduledAt: string | null;
  rescheduledToEntryId: string | null;
  rescheduledFromEntryId: string | null;
  expireAt: string | null;
}

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'confirmed' | 'expired' | 'declined';
export type NotificationChannel = 'sms' | 'app' | 'email';

export interface Notification {
  id: string;
  waitlistEntryId: string;
  studentId: string;
  courseId: string;
  slotId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  message: string;
  sentAt: string | null;
  confirmedAt: string | null;
  declinedAt: string | null;
  expireAt: string | null;
  result: string | null;
}

export interface WaitlistRescheduleResult {
  oldEntry: WaitlistEntry;
  newEntry: WaitlistEntry;
  newPositionInfo: {
    position: number;
    totalWaiting: number;
    estimatedChance: number;
  };
}

export interface AppConfig {
  maxWaitlistPerStudent: number;
  notificationTimeoutMinutes: number;
  notificationChannels: NotificationChannel[];
}

export const DEFAULT_CONFIG: AppConfig = {
  maxWaitlistPerStudent: 3,
  notificationTimeoutMinutes: 30,
  notificationChannels: ['sms', 'app']
};
