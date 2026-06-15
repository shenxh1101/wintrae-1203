import * as fs from 'fs';
import * as path from 'path';
import { Store, Course, CourseSlot, Student, WaitlistEntry, Notification, AppConfig, DEFAULT_CONFIG } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');

interface DataStore {
  stores: Store[];
  courses: Course[];
  courseSlots: CourseSlot[];
  students: Student[];
  waitlistEntries: WaitlistEntry[];
  notifications: Notification[];
  config: AppConfig;
}

const initialData: DataStore = {
  stores: [],
  courses: [],
  courseSlots: [],
  students: [],
  waitlistEntries: [],
  notifications: [],
  config: DEFAULT_CONFIG
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getDataFilePath(): string {
  ensureDataDir();
  return path.join(DATA_DIR, 'db.json');
}

export class DataRepository {
  private data: DataStore;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DataStore {
    const filePath = getDataFilePath();
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return { ...initialData, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('Failed to load data, using initial data:', err);
    }
    return JSON.parse(JSON.stringify(initialData));
  }

  save(): void {
    const filePath = getDataFilePath();
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save data:', err);
    }
  }

  getStores(): Store[] {
    return this.data.stores;
  }

  addStore(store: Store): void {
    this.data.stores.push(store);
    this.save();
  }

  getStoreById(id: string): Store | undefined {
    return this.data.stores.find(s => s.id === id);
  }

  getCourses(): Course[] {
    return this.data.courses;
  }

  addCourse(course: Course): void {
    this.data.courses.push(course);
    this.save();
  }

  getCourseById(id: string): Course | undefined {
    return this.data.courses.find(c => c.id === id);
  }

  getCoursesByStoreId(storeId: string): Course[] {
    return this.data.courses.filter(c => c.storeId === storeId);
  }

  getCourseSlots(): CourseSlot[] {
    return this.data.courseSlots;
  }

  addCourseSlot(slot: CourseSlot): void {
    this.data.courseSlots.push(slot);
    this.save();
  }

  getCourseSlotById(id: string): CourseSlot | undefined {
    return this.data.courseSlots.find(s => s.id === id);
  }

  getCourseSlotsByCourseId(courseId: string): CourseSlot[] {
    return this.data.courseSlots.filter(s => s.courseId === courseId);
  }

  updateCourseSlot(slot: CourseSlot): void {
    const idx = this.data.courseSlots.findIndex(s => s.id === slot.id);
    if (idx >= 0) {
      this.data.courseSlots[idx] = slot;
      this.save();
    }
  }

  getStudents(): Student[] {
    return this.data.students;
  }

  addStudent(student: Student): void {
    this.data.students.push(student);
    this.save();
  }

  getStudentById(id: string): Student | undefined {
    return this.data.students.find(s => s.id === id);
  }

  getStudentByPhone(phone: string): Student | undefined {
    return this.data.students.find(s => s.phone === phone);
  }

  getWaitlistEntries(): WaitlistEntry[] {
    return this.data.waitlistEntries;
  }

  addWaitlistEntry(entry: WaitlistEntry): void {
    this.data.waitlistEntries.push(entry);
    this.save();
  }

  updateWaitlistEntry(entry: WaitlistEntry): void {
    const idx = this.data.waitlistEntries.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      this.data.waitlistEntries[idx] = entry;
      this.save();
    }
  }

  getWaitlistEntryById(id: string): WaitlistEntry | undefined {
    return this.data.waitlistEntries.find(e => e.id === id);
  }

  getWaitlistBySlotId(slotId: string): WaitlistEntry[] {
    return this.data.waitlistEntries
      .filter(e => e.slotId === slotId)
      .sort((a, b) => a.queuePosition - b.queuePosition);
  }

  getActiveWaitlistBySlotId(slotId: string): WaitlistEntry[] {
    return this.data.waitlistEntries
      .filter(e => e.slotId === slotId && (e.status === 'waiting' || e.status === 'notified'))
      .sort((a, b) => a.queuePosition - b.queuePosition);
  }

  getWaitingWaitlistBySlotId(slotId: string): WaitlistEntry[] {
    return this.data.waitlistEntries
      .filter(e => e.slotId === slotId && e.status === 'waiting')
      .sort((a, b) => a.queuePosition - b.queuePosition);
  }

  getWaitlistByStudentId(studentId: string): WaitlistEntry[] {
    return this.data.waitlistEntries
      .filter(e => e.studentId === studentId)
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
  }

  getActiveWaitlistCountByStudentId(studentId: string): number {
    return this.data.waitlistEntries
      .filter(e => e.studentId === studentId && (e.status === 'waiting' || e.status === 'notified'))
      .length;
  }

  getNotifications(): Notification[] {
    return this.data.notifications;
  }

  addNotification(notification: Notification): void {
    this.data.notifications.push(notification);
    this.save();
  }

  updateNotification(notification: Notification): void {
    const idx = this.data.notifications.findIndex(n => n.id === notification.id);
    if (idx >= 0) {
      this.data.notifications[idx] = notification;
      this.save();
    }
  }

  getNotificationById(id: string): Notification | undefined {
    return this.data.notifications.find(n => n.id === id);
  }

  getNotificationsByWaitlistEntryId(entryId: string): Notification[] {
    return this.data.notifications
      .filter(n => n.waitlistEntryId === entryId)
      .sort((a, b) => new Date(b.sentAt || '').getTime() - new Date(a.sentAt || '').getTime());
  }

  getNotificationsByStudentId(studentId: string): Notification[] {
    return this.data.notifications
      .filter(n => n.studentId === studentId)
      .sort((a, b) => new Date(b.sentAt || '').getTime() - new Date(a.sentAt || '').getTime());
  }

  getConfig(): AppConfig {
    return this.data.config;
  }

  updateConfig(config: AppConfig): void {
    this.data.config = config;
    this.save();
  }
}

export const repository = new DataRepository();
