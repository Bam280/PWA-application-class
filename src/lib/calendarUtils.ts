import { ScheduleItem, ReminderItem } from '../types';

export interface CalendarDay {
  date: Date;
  dayNumber: number;
  monthIndex: number;
  year: number;
  dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  isCurrentMonth: boolean;
  isToday: boolean;
  hasSchedule: boolean;
  scheduleCount: number;
  deadlinesCount: number;
}

export interface CalendarWeek {
  weekIndexInMonth: number; // 1, 2, 3, 4, 5...
  academicWeekNumber: number; // e.g. 1 to 16 in semester
  startDate: Date;
  endDate: Date;
  label: string; // e.g. "Minggu 1 (2 - 8 Nov)"
  shortLabel: string; // e.g. "Minggu 1"
  days: CalendarDay[];
  hasToday: boolean;
  totalSchedules: number;
  totalDeadlines: number;
}

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const MONTH_NAMES_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export const DAY_NAMES_ID = [
  { value: 1, full: 'Senin', short: 'Sen' },
  { value: 2, full: 'Selasa', short: 'Sel' },
  { value: 3, full: 'Rabu', short: 'Rab' },
  { value: 4, full: 'Kamis', short: 'Kam' },
  { value: 5, full: 'Jumat', short: 'Jum' },
  { value: 6, full: 'Sabtu', short: 'Sab' },
  { value: 7, full: 'Minggu', short: 'Min' },
];

/**
 * Checks if two dates are the same day (Year, Month, Date)
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/** Local calendar date as "YYYY-MM-DD", the format schedules are stored in. */
export function toDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Reads "YYYY-MM-DD" as local midnight (`new Date(key)` would read it as UTC). Null if it is not a real date. */
export function parseDateKey(key?: string | null): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? '');
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** 1 = Monday ... 7 = Sunday. */
export function dayOfWeekOf(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** The seven days (Monday first) of the week `weekOffset` weeks away from the one holding `from`. */
export function getWeekDays(from: Date, weekOffset = 0): Date[] {
  const monday = new Date(from.getFullYear(), from.getMonth(), from.getDate() - dayOfWeekOf(from) + 1 + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

/**
 * Formats a date into "Senin, 4 Nov 2026"
 */
export function formatFullIndonesianDate(d: Date): string {
  const dayName = DAY_NAMES_ID.find((item) => item.value === (d.getDay() === 0 ? 7 : d.getDay()))?.full || '';
  const monthName = MONTH_NAMES_SHORT_ID[d.getMonth()];
  return `${dayName}, ${d.getDate()} ${monthName} ${d.getFullYear()}`;
}

/**
 * Formats a date into "4 Nov"
 */
export function formatShortIndonesianDate(d: Date): string {
  const monthName = MONTH_NAMES_SHORT_ID[d.getMonth()];
  return `${d.getDate()} ${monthName}`;
}

/**
 * Calculates academic week number based on semester start (typically September for Odd Semester or February for Even Semester)
 */
export function calculateAcademicWeek(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  
  // Odd semester starts ~first Monday of September (month 8)
  // Even semester starts ~first Monday of February (month 1)
  let semesterStart: Date;
  if (month >= 8) {
    semesterStart = new Date(year, 8, 1);
  } else if (month <= 1) {
    semesterStart = new Date(year - 1, 8, 1);
  } else {
    semesterStart = new Date(year, 1, 1);
  }

  const diffTime = date.getTime() - semesterStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7) + 1;
  return Math.max(1, Math.min(16, weekNum));
}

/**
 * Generates the full calendar weeks and day matrix for a specific month and year
 */
export function getMonthCalendarWeeks(
  year: number,
  monthIndex: number,
  schedules: ScheduleItem[] = [],
  reminders: ReminderItem[] = []
): CalendarWeek[] {
  const today = new Date();
  
  // First day of current month
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  // Total days in month
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Find Monday of the first week (1 = Monday, 7 = Sunday)
  const firstDayRaw = firstDayOfMonth.getDay();
  const firstDayMondayBased = firstDayRaw === 0 ? 7 : firstDayRaw; // 1 to 7
  const leadingDaysCount = firstDayMondayBased - 1;

  // Calendar starts on Monday of week 1
  const calendarStartDate = new Date(year, monthIndex, 1 - leadingDaysCount);

  // Group into weeks of 7 days each
  const weeks: CalendarWeek[] = [];
  let currentDayPointer = new Date(calendarStartDate);
  let weekIndex = 1;

  // We continue until we reach past the end of the month AND complete the 7-day row
  while (true) {
    const weekDays: CalendarDay[] = [];
    let weekHasToday = false;
    let weekScheduleCount = 0;
    let weekDeadlineCount = 0;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(currentDayPointer);
      const isCurrentMonth = dayDate.getMonth() === monthIndex;
      const isTodayDate = isSameDay(dayDate, today);
      if (isTodayDate) weekHasToday = true;

      const dayOfWeek = dayDate.getDay() === 0 ? 7 : dayDate.getDay();

      // Schedules on this exact date
      const dayKey = toDateKey(dayDate);
      const daySchedules = schedules.filter((s) => s.date === dayKey);
      const hasSched = daySchedules.length > 0;
      weekScheduleCount += daySchedules.length;

      // Reminders / deadlines falling on this specific calendar date
      const dayReminders = reminders.filter((r) => {
        try {
          const rDate = new Date(r.deadline);
          return isSameDay(rDate, dayDate);
        } catch {
          return false;
        }
      });
      weekDeadlineCount += dayReminders.length;

      weekDays.push({
        date: dayDate,
        dayNumber: dayDate.getDate(),
        monthIndex: dayDate.getMonth(),
        year: dayDate.getFullYear(),
        dayOfWeek,
        isCurrentMonth,
        isToday: isTodayDate,
        hasSchedule: hasSched,
        scheduleCount: daySchedules.length,
        deadlinesCount: dayReminders.length,
      });

      // Advance 1 day
      currentDayPointer.setDate(currentDayPointer.getDate() + 1);
    }

    const weekStartDate = weekDays[0].date;
    const weekEndDate = weekDays[6].date;
    const academicWeek = calculateAcademicWeek(weekStartDate);

    const startStr = `${weekStartDate.getDate()} ${MONTH_NAMES_SHORT_ID[weekStartDate.getMonth()]}`;
    const endStr = `${weekEndDate.getDate()} ${MONTH_NAMES_SHORT_ID[weekEndDate.getMonth()]}`;

    weeks.push({
      weekIndexInMonth: weekIndex,
      academicWeekNumber: academicWeek,
      startDate: weekStartDate,
      endDate: weekEndDate,
      label: `Minggu ${weekIndex} (${startStr} - ${endStr})`,
      shortLabel: `Minggu ${weekIndex}`,
      days: weekDays,
      hasToday: weekHasToday,
      totalSchedules: weekScheduleCount,
      totalDeadlines: weekDeadlineCount,
    });

    weekIndex++;

    // Check if we've covered the whole month and finished the week
    const hasPassedMonth = currentDayPointer.getMonth() !== monthIndex && currentDayPointer.getDate() > 1;
    if (hasPassedMonth || weekIndex > 6) {
      break;
    }
  }

  return weeks;
}

/**
 * Given a week and target day of week (1=Mon ... 7=Sun), returns the exact date for that day in that week
 */
export function getDateInWeek(week: CalendarWeek, targetDayOfWeek: number): Date {
  const match = week.days.find((d) => d.dayOfWeek === targetDayOfWeek);
  if (match) return match.date;

  // Fallback calculation: startDate is Monday (1)
  const result = new Date(week.startDate);
  result.setDate(result.getDate() + (targetDayOfWeek - 1));
  return result;
}

/**
 * Builds Google Calendar URL for a specific date and schedule item
 */
export function getGoogleCalendarUrlForDateSchedule(
  schedule: ScheduleItem,
  targetDate?: Date | null
): string {
  if (!schedule) return '#';

  const safeDate = targetDate instanceof Date && !isNaN(targetDate.getTime()) ? targetDate : new Date();
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');

  const rawStart = String(schedule.startTime || (schedule as any).start || (schedule as any).start_time || '08:00');
  const cleanStart = rawStart.replace(/[^0-9]/g, '').padEnd(4, '0').slice(0, 4);

  const rawEnd = String(schedule.endTime || (schedule as any).end || (schedule as any).end_time || '10:00');
  const cleanEnd = rawEnd.replace(/[^0-9]/g, '').padEnd(4, '0').slice(0, 4);

  const startFormatted = `${year}${month}${day}T${cleanStart}00`;
  const endFormatted = `${year}${month}${day}T${cleanEnd}00`;

  const lecturer = schedule.lecturer || 'Pembicara Divisi';
  const speakerInfo = schedule.speakerRole
    ? `${lecturer} (${schedule.speakerRole})`
    : lecturer;
  const divisionInfo = schedule.divisionName ? `Divisi: ${schedule.divisionName}\n` : '';

  const courseCode = schedule.courseCode || 'ODP-IT';
  const courseName = schedule.courseName || 'Sesi Pelatihan IT';
  const room = schedule.room || 'Ruang Kelas';
  const building = schedule.building || 'BNI Corporate University';
  const classType = (schedule.classType || 'offline').toUpperCase();

  const title = encodeURIComponent(`[ODP IT BNI] ${courseCode} - ${courseName}`);
  const details = encodeURIComponent(
    `Sesi / Topik: ${courseName}\n` +
    `Kode Modul: ${courseCode}\n` +
    divisionInfo +
    `Pembicara: ${speakerInfo}\n` +
    `Ruang Kelas: ${room} (${building})\n` +
    `Tipe: ${classType}\n` +
    (schedule.notes ? `Catatan: ${schedule.notes}\n` : '') +
    `ODP IT Class BNI Corporate University 2026`
  );
  const location = encodeURIComponent(`${room}, ${building}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startFormatted}/${endFormatted}&details=${details}&location=${location}`;
}
