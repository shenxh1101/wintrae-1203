import { repository } from '../repository';
import { WaitlistEntry, DailyTrendRow } from '../types';

export interface CourseHeatRank {
  courseId: string;
  courseName: string;
  storeId: string;
  storeName: string;
  category: string;
  totalWaitlistCount: number;
  waitingCount: number;
  notifiedCount: number;
  confirmedCount: number;
  declinedCount: number;
  expiredCount: number;
  cancelledCount: number;
  rescheduledCount: number;
  conversionRate: number;
}

export interface StoreConversion {
  storeId: string;
  storeName: string;
  totalWaitlistEntries: number;
  waitingCount: number;
  notifiedCount: number;
  confirmedCount: number;
  enrolledCount: number;
  declinedCount: number;
  cancelledCount: number;
  expiredCount: number;
  rescheduledCount: number;
  conversionRate: number;
  notificationSentCount: number;
  notificationConfirmedCount: number;
}

export interface DashboardSlotRow {
  slotId: string;
  courseId: string;
  courseName: string;
  storeId: string;
  storeName: string;
  startTime: string;
  endTime: string;
  capacity: number;
  enrolledCount: number;
  waitingCount: number;
  notifiedPendingCount: number;
  confirmedCount: number;
  declinedCount: number;
  cancelledCount: number;
  expiredCount: number;
  rescheduledCount: number;
  totalCount: number;
  conversionRate: number;
}

export interface DashboardCourseRow {
  courseId: string;
  courseName: string;
  storeId: string;
  storeName: string;
  category: string;
  slotCount: number;
  waitingCount: number;
  notifiedPendingCount: number;
  confirmedCount: number;
  declinedCount: number;
  cancelledCount: number;
  expiredCount: number;
  rescheduledCount: number;
  totalCount: number;
  conversionRate: number;
}

export interface DashboardStoreRow {
  storeId: string;
  storeName: string;
  courseCount: number;
  slotCount: number;
  waitingCount: number;
  notifiedPendingCount: number;
  confirmedCount: number;
  declinedCount: number;
  cancelledCount: number;
  expiredCount: number;
  rescheduledCount: number;
  totalCount: number;
  conversionRate: number;
}

export interface OperationDashboard {
  filters: {
    storeId: string | null;
    courseId: string | null;
    slotId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  summary: {
    totalCount: number;
    waitingCount: number;
    notifiedPendingCount: number;
    confirmedCount: number;
    declinedCount: number;
    cancelledCount: number;
    expiredCount: number;
    rescheduledCount: number;
    conversionRate: number;
  };
  bySlot: DashboardSlotRow[];
  byCourse: DashboardCourseRow[];
  byStore: DashboardStoreRow[];
  dailyTrend: DailyTrendRow[];
}

interface StatusCounter {
  waiting: number;
  notified: number;
  confirmed: number;
  declined: number;
  expired: number;
  cancelled: number;
  rescheduled: number;
  enrolled: number;
  total: number;
}

function makeCounter(): StatusCounter {
  return { waiting: 0, notified: 0, confirmed: 0, declined: 0, expired: 0, cancelled: 0, rescheduled: 0, enrolled: 0, total: 0 };
}

function tally(counter: StatusCounter, entry: WaitlistEntry): void {
  counter.total++;
  switch (entry.status) {
    case 'waiting': counter.waiting++; break;
    case 'notified': counter.notified++; break;
    case 'confirmed': counter.confirmed++; break;
    case 'declined': counter.declined++; break;
    case 'expired': counter.expired++; break;
    case 'cancelled': counter.cancelled++; break;
    case 'rescheduled': counter.rescheduled++; break;
    case 'enrolled': counter.enrolled++; break;
  }
}

function conversionRateOf(counter: StatusCounter): number {
  const completed = counter.confirmed + counter.enrolled + counter.declined + counter.expired;
  return completed > 0 ? Math.round(((counter.confirmed + counter.enrolled) / completed) * 100) : 0;
}

export class StatisticsService {
  getOperationDashboard(
    storeId?: string,
    courseId?: string,
    slotId?: string,
    dateFrom?: string,
    dateTo?: string
  ): OperationDashboard {
    const stores = repository.getStores();
    const courses = repository.getCourses();
    const slots = repository.getCourseSlots();
    const allEntries = repository.getWaitlistEntries();

    let validSlotIds: Set<string> | null = null;

    if (storeId || courseId || slotId || dateFrom || dateTo) {
      validSlotIds = new Set<string>();
      for (const slot of slots) {
        if (slotId && slot.id !== slotId) continue;
        const course = courses.find(c => c.id === slot.courseId);
        if (courseId && slot.courseId !== courseId) continue;
        if (storeId && course && course.storeId !== storeId) continue;
        if (dateFrom) {
          const slotStart = new Date(slot.startTime);
          const from = new Date(dateFrom);
          if (slotStart < from) continue;
        }
        if (dateTo) {
          const slotStart = new Date(slot.startTime);
          const to = new Date(dateTo);
          to.setDate(to.getDate() + 1);
          if (slotStart >= to) continue;
        }
        validSlotIds.add(slot.id);
      }
    }

    let filteredEntries = allEntries;
    if (validSlotIds) {
      filteredEntries = filteredEntries.filter(e => validSlotIds!.has(e.slotId));
    }

    const filteredSlots = validSlotIds
      ? slots.filter(s => validSlotIds!.has(s.id))
      : slots;

    const filteredCourseIds = new Set(filteredSlots.map(s => s.courseId));
    const filteredCourses = validSlotIds
      ? courses.filter(c => filteredCourseIds.has(c.id))
      : courses;

    const filteredStoreIds = new Set(filteredCourses.map(c => c.storeId));
    const filteredStores = validSlotIds
      ? stores.filter(s => filteredStoreIds.has(s.id))
      : stores;

    const summary = makeCounter();
    for (const e of filteredEntries) tally(summary, e);

    const bySlot: DashboardSlotRow[] = [];
    for (const slot of filteredSlots) {
      const c = makeCounter();
      const entriesOfSlot = filteredEntries.filter(e => e.slotId === slot.id);
      for (const e of entriesOfSlot) tally(c, e);
      const course = courses.find(x => x.id === slot.courseId);
      const store = stores.find(x => x.id === course?.storeId);
      bySlot.push({
        slotId: slot.id,
        courseId: slot.courseId,
        courseName: course?.name || '',
        storeId: store?.id || '',
        storeName: store?.name || '',
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        enrolledCount: slot.enrolledCount,
        waitingCount: c.waiting,
        notifiedPendingCount: c.notified,
        confirmedCount: c.confirmed,
        declinedCount: c.declined,
        cancelledCount: c.cancelled,
        expiredCount: c.expired,
        rescheduledCount: c.rescheduled,
        totalCount: c.total,
        conversionRate: conversionRateOf(c)
      });
    }
    bySlot.sort((a, b) => b.totalCount - a.totalCount);

    const byCourse: DashboardCourseRow[] = [];
    for (const course of filteredCourses) {
      const c = makeCounter();
      const entriesOfCourse = filteredEntries.filter(e => e.courseId === course.id);
      for (const e of entriesOfCourse) tally(c, e);
      const store = stores.find(x => x.id === course.storeId);
      const slotCountOfCourse = filteredSlots.filter(s => s.courseId === course.id).length;
      byCourse.push({
        courseId: course.id,
        courseName: course.name,
        storeId: course.storeId,
        storeName: store?.name || '',
        category: course.category,
        slotCount: slotCountOfCourse,
        waitingCount: c.waiting,
        notifiedPendingCount: c.notified,
        confirmedCount: c.confirmed,
        declinedCount: c.declined,
        cancelledCount: c.cancelled,
        expiredCount: c.expired,
        rescheduledCount: c.rescheduled,
        totalCount: c.total,
        conversionRate: conversionRateOf(c)
      });
    }
    byCourse.sort((a, b) => b.totalCount - a.totalCount);

    const byStore: DashboardStoreRow[] = [];
    for (const store of filteredStores) {
      const c = makeCounter();
      const courseIdsOfStore = filteredCourses.filter(crs => crs.storeId === store.id).map(crs => crs.id);
      const entriesOfStore = filteredEntries.filter(e => courseIdsOfStore.includes(e.courseId));
      for (const e of entriesOfStore) tally(c, e);
      const coursesOfStore = filteredCourses.filter(crs => crs.storeId === store.id);
      const slotCountOfStore = filteredSlots.filter(s => courseIdsOfStore.includes(s.courseId)).length;
      byStore.push({
        storeId: store.id,
        storeName: store.name,
        courseCount: coursesOfStore.length,
        slotCount: slotCountOfStore,
        waitingCount: c.waiting,
        notifiedPendingCount: c.notified,
        confirmedCount: c.confirmed,
        declinedCount: c.declined,
        cancelledCount: c.cancelled,
        expiredCount: c.expired,
        rescheduledCount: c.rescheduled,
        totalCount: c.total,
        conversionRate: conversionRateOf(c)
      });
    }
    byStore.sort((a, b) => b.totalCount - a.totalCount);

    const dailyTrend = this.getDailyTrend(
      filteredEntries,
      dateFrom,
      dateTo
    );

    return {
      filters: {
        storeId: storeId || null,
        courseId: courseId || null,
        slotId: slotId || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      },
      summary: {
        totalCount: summary.total,
        waitingCount: summary.waiting,
        notifiedPendingCount: summary.notified,
        confirmedCount: summary.confirmed + summary.enrolled,
        declinedCount: summary.declined,
        cancelledCount: summary.cancelled,
        expiredCount: summary.expired,
        rescheduledCount: summary.rescheduled,
        conversionRate: conversionRateOf(summary)
      },
      bySlot,
      byCourse,
      byStore,
      dailyTrend
    };
  }

  getDailyTrend(
    entries?: WaitlistEntry[],
    dateFrom?: string,
    dateTo?: string
  ): DailyTrendRow[] {
    const allEntries = entries || repository.getWaitlistEntries();

    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (dateFrom) fromDate = new Date(dateFrom);
    if (dateTo) {
      toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
    }

    if (!fromDate && !toDate) {
      const allDates: Date[] = [];
      for (const e of allEntries) {
        if (e.joinedAt) allDates.push(new Date(e.joinedAt));
        if (e.notifiedAt) allDates.push(new Date(e.notifiedAt));
        if (e.confirmedAt) allDates.push(new Date(e.confirmedAt));
        if (e.declinedAt) allDates.push(new Date(e.declinedAt));
        if (e.expireAt) allDates.push(new Date(e.expireAt));
        if (e.cancelledAt) allDates.push(new Date(e.cancelledAt));
        if (e.rescheduledAt) allDates.push(new Date(e.rescheduledAt));
      }
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        minDate.setHours(0, 0, 0, 0);
        maxDate.setHours(0, 0, 0, 0);
        fromDate = minDate;
        toDate = new Date(maxDate);
        toDate.setDate(toDate.getDate() + 1);
      }
    }

    if (!fromDate) {
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 6);
      fromDate.setHours(0, 0, 0, 0);
    }
    if (!toDate) {
      toDate = new Date();
      toDate.setHours(0, 0, 0, 0);
      toDate.setDate(toDate.getDate() + 1);
    }

    type DailyKey = 'joined' | 'notified' | 'confirmed' | 'declined' | 'expired' | 'cancelled' | 'rescheduled';

    const dayMap = new Map<string, Record<DailyKey, number>>();

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmtDate = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const events: { date: string; type: DailyKey }[] = [];

    for (const e of allEntries) {
      if (e.joinedAt) {
        const d = new Date(e.joinedAt);
        if (d >= fromDate && d < toDate) events.push({ date: fmtDate(d), type: 'joined' });
      }
      if (e.notifiedAt) {
        const d = new Date(e.notifiedAt);
        if (d >= fromDate && d < toDate) events.push({ date: fmtDate(d), type: 'notified' });
      }
      if (e.confirmedAt) {
        const d = new Date(e.confirmedAt);
        if (d >= fromDate && d < toDate) events.push({ date: fmtDate(d), type: 'confirmed' });
      }
      if (e.declinedAt) {
        const d = new Date(e.declinedAt);
        if (d >= fromDate && d < toDate) events.push({ date: fmtDate(d), type: 'declined' });
      }
      if (e.status === 'expired' && e.expireAt) {
        const d = new Date(e.expireAt);
        if (d >= fromDate && d < toDate) events.push({ date: fmtDate(d), type: 'expired' });
      }
      if (e.cancelledAt) {
        const d = new Date(e.cancelledAt);
        if (d >= fromDate && d < toDate) events.push({ date: fmtDate(d), type: 'cancelled' });
      }
      if (e.rescheduledAt) {
        const d = new Date(e.rescheduledAt);
        if (d >= fromDate && d < toDate) events.push({ date: fmtDate(d), type: 'rescheduled' });
      }
    }

    const zeroCounter: Record<DailyKey, number> = {
      joined: 0, notified: 0, confirmed: 0,
      declined: 0, expired: 0, cancelled: 0, rescheduled: 0
    };

    for (const ev of events) {
      if (!dayMap.has(ev.date)) {
        dayMap.set(ev.date, { ...zeroCounter });
      }
      const day = dayMap.get(ev.date)!;
      day[ev.type]++;
    }

    const result: DailyTrendRow[] = [];
    const cur = new Date(fromDate);
    while (cur < toDate) {
      const dateStr = fmtDate(cur);
      const d = dayMap.get(dateStr) || { ...zeroCounter };
      const total = d.joined + d.notified + d.confirmed + d.declined + d.expired + d.cancelled + d.rescheduled;
      const completed = d.confirmed + d.declined + d.expired;
      const conversionRate = completed > 0 ? Math.round((d.confirmed / completed) * 100) : 0;

      result.push({
        date: dateStr,
        joined: d.joined,
        notified: d.notified,
        confirmed: d.confirmed,
        declined: d.declined,
        expired: d.expired,
        cancelled: d.cancelled,
        rescheduled: d.rescheduled,
        totalEvents: total,
        conversionRate
      });

      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }

  getCourseHeatRank(limit: number = 10): CourseHeatRank[] {
    const courses = repository.getCourses();
    const stores = repository.getStores();
    const entries = repository.getWaitlistEntries();

    const courseStats = new Map<string, StatusCounter>();

    for (const entry of entries) {
      const stats = courseStats.get(entry.courseId) || makeCounter();
      tally(stats, entry);
      courseStats.set(entry.courseId, stats);
    }

    const ranks: CourseHeatRank[] = [];
    for (const course of courses) {
      const stats = courseStats.get(course.id) || makeCounter();
      const store = stores.find(s => s.id === course.storeId);

      ranks.push({
        courseId: course.id,
        courseName: course.name,
        storeId: course.storeId,
        storeName: store?.name || '',
        category: course.category,
        totalWaitlistCount: stats.total,
        waitingCount: stats.waiting,
        notifiedCount: stats.notified,
        confirmedCount: stats.confirmed + stats.enrolled,
        declinedCount: stats.declined,
        expiredCount: stats.expired,
        cancelledCount: stats.cancelled,
        rescheduledCount: stats.rescheduled,
        conversionRate: conversionRateOf(stats)
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

    const courseToStore = new Map<string, string>();
    for (const c of courses) {
      courseToStore.set(c.id, c.storeId);
    }

    const results: StoreConversion[] = [];

    for (const store of stores) {
      const c = makeCounter();
      const storeEntries = entries.filter(e => courseToStore.get(e.courseId) === store.id);
      for (const e of storeEntries) tally(c, e);

      const storeNotifications = notifications.filter(n => courseToStore.get(n.courseId) === store.id);
      const notificationSentCount = storeNotifications.filter(n => n.status !== 'pending' && n.status !== 'failed').length;
      const notificationConfirmedCount = storeNotifications.filter(n => n.status === 'confirmed').length;

      results.push({
        storeId: store.id,
        storeName: store.name,
        totalWaitlistEntries: c.total,
        waitingCount: c.waiting,
        notifiedCount: c.notified,
        confirmedCount: c.confirmed,
        enrolledCount: c.enrolled,
        declinedCount: c.declined,
        cancelledCount: c.cancelled,
        expiredCount: c.expired,
        rescheduledCount: c.rescheduled,
        conversionRate: conversionRateOf(c),
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

    const c = makeCounter();
    for (const e of entries) tally(c, e);

    const totalNotifications = notifications.length;
    const confirmedNotifications = notifications.filter(n => n.status === 'confirmed').length;
    const expiredNotifications = notifications.filter(n => n.status === 'expired').length;
    const declinedNotifications = notifications.filter(n => n.status === 'declined').length;

    return {
      totalEntries: c.total,
      waitingEntries: c.waiting,
      notifiedPendingEntries: c.notified,
      confirmedEntries: c.confirmed + c.enrolled,
      declinedEntries: c.declined,
      cancelledEntries: c.cancelled,
      expiredEntries: c.expired,
      rescheduledEntries: c.rescheduled,
      totalCourses: courses.length,
      totalSlots: slots.length,
      totalNotifications,
      confirmedNotifications,
      declinedNotifications,
      expiredNotifications,
      overallConversionRate: conversionRateOf(c)
    };
  }
}
