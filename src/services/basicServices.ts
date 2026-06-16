import { v4 as uuidv4 } from 'uuid';
import { repository } from '../repository';
import {
  Store, Course, CourseSlot, Student, WaitlistEntry, Notification,
  WaitlistStatus, NotificationStatus, NotificationChannel
} from '../types';

export class StoreService {
  createStore(name: string, address: string): Store {
    const store: Store = {
      id: uuidv4(),
      name,
      address,
      createdAt: new Date().toISOString()
    };
    repository.addStore(store);
    return store;
  }

  getStores(): Store[] {
    return repository.getStores();
  }

  getStoreById(id: string): Store | undefined {
    return repository.getStoreById(id);
  }
}

export class CourseService {
  createCourse(name: string, storeId: string, description: string, category: string): Course {
    const course: Course = {
      id: uuidv4(),
      name,
      storeId,
      description,
      category,
      createdAt: new Date().toISOString()
    };
    repository.addCourse(course);
    return course;
  }

  getCourses(): Course[] {
    return repository.getCourses();
  }

  getCourseById(id: string): Course | undefined {
    return repository.getCourseById(id);
  }

  getCoursesByStoreId(storeId: string): Course[] {
    return repository.getCoursesByStoreId(storeId);
  }
}

export class CourseSlotService {
  createCourseSlot(
    courseId: string,
    startTime: string,
    endTime: string,
    capacity: number
  ): CourseSlot {
    const slot: CourseSlot = {
      id: uuidv4(),
      courseId,
      startTime,
      endTime,
      capacity,
      enrolledCount: 0,
      createdAt: new Date().toISOString()
    };
    repository.addCourseSlot(slot);
    return slot;
  }

  getCourseSlots(): CourseSlot[] {
    return repository.getCourseSlots();
  }

  getCourseSlotById(id: string): CourseSlot | undefined {
    return repository.getCourseSlotById(id);
  }

  getCourseSlotsByCourseId(courseId: string): CourseSlot[] {
    return repository.getCourseSlotsByCourseId(courseId);
  }

  incrementEnrolled(slotId: string, count: number = 1): CourseSlot | undefined {
    const slot = repository.getCourseSlotById(slotId);
    if (slot) {
      slot.enrolledCount = Math.min(slot.capacity, slot.enrolledCount + count);
      repository.updateCourseSlot(slot);
    }
    return slot;
  }

  decrementEnrolled(slotId: string, count: number = 1): CourseSlot | undefined {
    const slot = repository.getCourseSlotById(slotId);
    if (slot) {
      slot.enrolledCount = Math.max(0, slot.enrolledCount - count);
      repository.updateCourseSlot(slot);
    }
    return slot;
  }

  hasAvailableSlot(slotId: string): boolean {
    const slot = repository.getCourseSlotById(slotId);
    return !!slot && slot.enrolledCount < slot.capacity;
  }

  getAvailableCount(slotId: string): number {
    const slot = repository.getCourseSlotById(slotId);
    return slot ? slot.capacity - slot.enrolledCount : 0;
  }

  setEnrolledCount(slotId: string, enrolledCount: number): CourseSlot | undefined {
    const slot = repository.getCourseSlotById(slotId);
    if (!slot) return undefined;
    if (!Number.isInteger(enrolledCount) || enrolledCount < 0) {
      throw new Error(`enrolledCount 必须是非负整数，当前传入 ${enrolledCount}`);
    }
    if (enrolledCount > slot.capacity) {
      throw new Error(`enrolledCount (${enrolledCount}) 不能超过容量 capacity (${slot.capacity})`);
    }
    slot.enrolledCount = enrolledCount;
    repository.updateCourseSlot(slot);
    return slot;
  }
}

export class StudentService {
  getOrCreateStudent(name: string, phone: string): Student {
    let student = repository.getStudentByPhone(phone);
    if (!student) {
      student = {
        id: uuidv4(),
        name,
        phone,
        createdAt: new Date().toISOString()
      };
      repository.addStudent(student);
    }
    return student;
  }

  getStudents(): Student[] {
    return repository.getStudents();
  }

  getStudentById(id: string): Student | undefined {
    return repository.getStudentById(id);
  }
}
