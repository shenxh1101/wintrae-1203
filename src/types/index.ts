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
  releaseGroupId: string | null;
  chainOrder: number | null;
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

export interface NotificationTimelineItem {
  id: string;
  type: 'invite' | 'reminder' | 'result';
  status: NotificationStatus;
  sentAt: string;
  result: string | null;
  message: string;
}

export interface NotificationLedgerRow {
  waitlistEntryId: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  courseId: string;
  courseName: string;
  storeId: string;
  storeName: string;
  slotId: string;
  slotStartTime: string;
  slotEndTime: string;
  entryStatus: WaitlistStatus;
  firstNotifiedAt: string | null;
  finalResultAt: string | null;
  finalResult: string | null;
  reminderCount: number;
  remainingSeconds: number | null;
  isExpired: boolean;
  timeline: NotificationTimelineItem[];
}

export interface BatchReschedulePreview {
  sourceSlot: {
    slotId: string;
    courseName: string;
    slotStartTime: string;
    slotEndTime: string;
    currentWaiting: number;
    currentNotified: number;
    afterWaiting: number;
    afterNotified: number;
  };
  targetSlot: {
    slotId: string;
    courseName: string;
    slotStartTime: string;
    slotEndTime: string;
    currentWaiting: number;
    currentNotified: number;
    afterWaiting: number;
    afterNotified: number;
  };
  items: {
    entryId: string;
    studentName: string;
    currentQueuePosition: number;
    currentStatus: WaitlistStatus;
    newQueuePosition: number;
    willNotifyNext: boolean;
    canReschedule: boolean;
    errorMessage: string | null;
  }[];
  summary: {
    totalSelected: number;
    canReschedule: number;
    cannotReschedule: number;
    willNotifyInSource: number;
  };
}

export interface DailyTrendRow {
  date: string;
  joined: number;
  notified: number;
  confirmed: number;
  declined: number;
  expired: number;
  cancelled: number;
  rescheduled: number;
  totalEvents: number;
  conversionRate: number;
}

export interface ReleaseChainStep {
  order: number;
  waitlistEntryId: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  firstNotificationSentAt: string | null;
  finalResult: 'confirmed' | 'declined' | 'expired' | 'manual_ended' | 'pending' | null;
  finalResultAt: string | null;
  resultMessage: string | null;
  reminders: {
    notificationId: string;
    sentAt: string | null;
  }[];
}

export interface ReleaseChainLedger {
  releaseGroupId: string;
  storeId: string;
  storeName: string;
  courseId: string;
  courseName: string;
  slotId: string;
  slotStartTime: string;
  slotEndTime: string;
  releasedAt: string;
  releasedCount: number;
  steps: ReleaseChainStep[];
  totalForwardCount: number;
  finalStatus: 'filled' | 'partially_filled' | 'in_progress';
  finalWinnerStudentId: string | null;
  finalWinnerStudentName: string | null;
}

export interface DailyFunnelRow {
  date: string;
  joined: number;
  reached: number;
  confirmed: number;
  declined: number;
  expired: number;
  rescheduled: number;
  reachedRate: number;
  conversionOfReached: number;
  pendingAtDayEnd: number;
}

export interface PendingHotspot {
  slotId: string;
  courseId: string;
  courseName: string;
  storeId: string;
  storeName: string;
  slotStartTime: string;
  slotEndTime: string;
  pendingCount: number;
  avgWaitMinutes: number;
  longestWaitMinutes: number;
}

export interface FunnelAnalysis {
  dailyFunnel: DailyFunnelRow[];
  pendingHotspots: PendingHotspot[];
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
