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

      // Schedules for this weekday (active courses on this day of week)
      const daySchedules = isCurrentMonth
        ? schedules.filter((s) => s.dayOfWeek === dayOfWeek)
        : [];
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
  targetDate: Date
): string {
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');

  const startFormatted = `${year}${month}${day}T${schedule.startTime.replace(':', '')}00`;
  const endFormatted = `${year}${month}${day}T${schedule.endTime.replace(':', '')}00`;

  const speakerInfo = schedule.speakerRole
    ? `${schedule.lecturer} (${schedule.speakerRole})`
    : schedule.lecturer;
  const divisionInfo = schedule.divisionName ? `Divisi: ${schedule.divisionName}\n` : '';

  const title = encodeURIComponent(`[ODP IT BNI] ${schedule.courseCode} - ${schedule.courseName}`);
  const details = encodeURIComponent(
    `Sesi / Topik: ${schedule.courseName}\n` +
    `Kode Modul: ${schedule.courseCode}\n` +
    divisionInfo +
    `Pembicara: ${speakerInfo}\n` +
    `Ruang Kelas: ${schedule.room} (${schedule.building})\n` +
    `Tipe: ${schedule.classType.toUpperCase()}\n` +
    (schedule.notes ? `Catatan: ${schedule.notes}\n` : '') +
    `ODP IT Class BNI Corporate University 2026`
  );
  const location = encodeURIComponent(`${schedule.room}, ${schedule.building}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startFormatted}/${endFormatted}&details=${details}&location=${location}`;
}
