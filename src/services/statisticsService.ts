import { repository } from '../repository';

export interface CourseHeatRank {
  courseId: string;
  courseName: string;
  storeId: string;
  storeName: string;
  category: string;
  totalWaitlistCount: number;
  activeWaitlistCount: number;
  confirmedCount: number;
  expiredCount: number;
  cancelledCount: number;
  conversionRate: number;
}

export interface StoreConversion {
  storeId: string;
  storeName: string;
  totalWaitlistEntries: number;
  confirmedCount: number;
  enrolledCount: number;
  cancelledCount: number;
  expiredCount: number;
  conversionRate: number;
  notificationSentCount: number;
  notificationConfirmedCount: number;
}

export class StatisticsService {
  getCourseHeatRank(limit: number = 10): CourseHeatRank[] {
    const courses = repository.getCourses();
    const stores = repository.getStores();
    const slots = repository.getCourseSlots();
    const entries = repository.getWaitlistEntries();

    const courseStats = new Map<string, {
      total: number; active: number; confirmed: number; expired: number; cancelled: number;
    }>();

    for (const entry of entries) {
      const stats = courseStats.get(entry.courseId) || { total: 0, active: 0, confirmed: 0, expired: 0, cancelled: 0 };
      stats.total++;
      if (entry.status === 'waiting' || entry.status === 'notified') stats.active++;
      if (entry.status === 'confirmed' || entry.status === 'enrolled') stats.confirmed++;
      if (entry.status === 'expired') stats.expired++;
      if (entry.status === 'cancelled') stats.cancelled++;
      courseStats.set(entry.courseId, stats);
    }

    const ranks: CourseHeatRank[] = [];
    for (const course of courses) {
      const stats = courseStats.get(course.id) || { total: 0, active: 0, confirmed: 0, expired: 0, cancelled: 0 };
      const store = stores.find(s => s.id === course.storeId);
      const notifiedOrDone = stats.confirmed + stats.expired;
      const conversionRate = notifiedOrDone > 0 ? Math.round((stats.confirmed / notifiedOrDone) * 100) : 0;

      ranks.push({
        courseId: course.id,
        courseName: course.name,
        storeId: course.storeId,
        storeName: store?.name || '',
        category: course.category,
        totalWaitlistCount: stats.total,
        activeWaitlistCount: stats.active,
        confirmedCount: stats.confirmed,
        expiredCount: stats.expired,
        cancelledCount: stats.cancelled,
        conversionRate
      });
    }

    ranks.sort((a, b) => b.totalWaitlistCount - a.totalWaitlistCount);
    return ranks.slice(0, limit);
  }

  getStoreConversions(): StoreConversion[] {
    const stores = repository.getStores();
    const courses = repository.getCourses();
    const entries = repository.getWaitlistEntries();
    const notifications = repository.getNotifications();

    const storeIds = stores.map(s => s.id);
    const courseToStore = new Map<string, string>();
    for (const c of courses) {
      courseToStore.set(c.id, c.storeId);
    }

    const results: StoreConversion[] = [];

    for (const store of stores) {
      const storeEntries = entries.filter(e => courseToStore.get(e.courseId) === store.id);
      const storeNotifications = notifications.filter(n => courseToStore.get(n.courseId) === store.id);

      const confirmedCount = storeEntries.filter(e => e.status === 'confirmed' || e.status === 'enrolled').length;
      const enrolledCount = storeEntries.filter(e => e.status === 'enrolled').length;
      const cancelledCount = storeEntries.filter(e => e.status === 'cancelled').length;
      const expiredCount = storeEntries.filter(e => e.status === 'expired').length;
      const notificationSentCount = storeNotifications.filter(n => n.status === 'sent' || n.status === 'confirmed' || n.status === 'expired').length;
      const notificationConfirmedCount = storeNotifications.filter(n => n.status === 'confirmed').length;

      const notifiedEntries = storeEntries.filter(e =>
        e.status === 'confirmed' || e.status === 'enrolled' || e.status === 'expired'
      );
      const conversionRate = notifiedEntries.length > 0
        ? Math.round((confirmedCount / notifiedEntries.length) * 100)
        : 0;

      results.push({
        storeId: store.id,
        storeName: store.name,
        totalWaitlistEntries: storeEntries.length,
        confirmedCount,
        enrolledCount,
        cancelledCount,
        expiredCount,
        conversionRate,
        notificationSentCount,
        notificationConfirmedCount
      });
    }

    return results.sort((a, b) => b.totalWaitlistEntries - a.totalWaitlistEntries);
  }

  getOverallStatistics() {
    const entries = repository.getWaitlistEntries();
    const notifications = repository.getNotifications();
    const courses = repository.getCourses();
    const slots = repository.getCourseSlots();

    const totalEntries = entries.length;
    const activeEntries = entries.filter(e => e.status === 'waiting' || e.status === 'notified').length;
    const confirmedEntries = entries.filter(e => e.status === 'confirmed' || e.status === 'enrolled').length;
    const cancelledEntries = entries.filter(e => e.status === 'cancelled').length;
    const expiredEntries = entries.filter(e => e.status === 'expired').length;

    const totalNotifications = notifications.length;
    const confirmedNotifications = notifications.filter(n => n.status === 'confirmed').length;
    const expiredNotifications = notifications.filter(n => n.status === 'expired').length;

    return {
      totalEntries,
      activeEntries,
      confirmedEntries,
      cancelledEntries,
      expiredEntries,
      totalCourses: courses.length,
      totalSlots: slots.length,
      totalNotifications,
      confirmedNotifications,
      expiredNotifications,
      overallConversionRate: (confirmedEntries + expiredEntries) > 0
        ? Math.round((confirmedEntries / (confirmedEntries + expiredEntries)) * 100)
        : 0
    };
  }
}
