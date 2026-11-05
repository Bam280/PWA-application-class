import { ScheduleItem, ReminderItem } from '../types';

// Map day numbers (1 = Monday, ..., 7 = Sunday) to iCalendar BYDAY format
const ICAL_DAY_MAP: Record<number, string> = {
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
  7: 'SU',
};

// Calculate next target date for a given day of the week (1-7)
function getNextDateForDay(dayOfWeek: number, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();
  const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // standard 1-7
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil < 0) {
    daysUntil += 7;
  }
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntil);
  target.setHours(hours || 8, minutes || 0, 0, 0);
  return target;
}

function formatICalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function formatGoogleDate(date: Date): string {
  return formatICalDate(date);
}

/**
 * Generate RFC 5545 iCalendar (.ics) string for university schedules
 */
export function generateSchedulesICS(schedules: ScheduleItem[], calendarName = 'Jadwal Kuliah Semester Ini'): string {
  const nowStr = formatICalDate(new Date());

  const eventBlocks = schedules.map(item => {
    const startDate = getNextDateForDay(item.dayOfWeek, item.startTime);
    const [startH, startM] = item.startTime.split(':').map(Number);
    const [endH, endM] = item.endTime.split(':').map(Number);

    const endDate = new Date(startDate);
    const durationMin = (endH * 60 + endM) - (startH * 60 + startM);
    endDate.setMinutes(startDate.getMinutes() + (durationMin > 0 ? durationMin : 100));

    const byDay = ICAL_DAY_MAP[item.dayOfWeek] || 'MO';
    const summary = `[ODP IT BNI] ${item.courseCode} - ${item.courseName}`;
    const location = `${item.room}, ${item.building}`;
    const speakerText = item.speakerRole ? `${item.lecturer} (${item.speakerRole})` : item.lecturer;
    const divisionText = item.divisionName ? `Divisi: ${item.divisionName}\\n` : '';
    const description = `${divisionText}Pembicara: ${speakerText}\\nRuang: ${item.room}\\nMode: ${item.classType.toUpperCase()}\\nCatatan: ${item.notes || 'Tidak ada catatan khusus.'}\\nODP IT BNI Class Management`;

    return [
      'BEGIN:VEVENT',
      `UID:odp-bni-sch-${item.id}@bni.co.id`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${formatICalDate(startDate)}`,
      `DTEND:${formatICalDate(endDate)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BNI Corporate University//ODP IT Class Schedule Sync//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-TIMEZONE:Asia/Jakarta',
    ...eventBlocks,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Generate direct Google Calendar URL for a single class schedule
 */
export function getGoogleCalendarUrlForSchedule(item: ScheduleItem): string {
  const startDate = getNextDateForDay(item.dayOfWeek, item.startTime);
  const [startH, startM] = item.startTime.split(':').map(Number);
  const [endH, endM] = item.endTime.split(':').map(Number);

  const endDate = new Date(startDate);
  const durationMin = (endH * 60 + endM) - (startH * 60 + startM);
  endDate.setMinutes(startDate.getMinutes() + (durationMin > 0 ? durationMin : 100));

  const byDay = ICAL_DAY_MAP[item.dayOfWeek] || 'MO';
  const title = encodeURIComponent(`[ODP IT BNI] ${item.courseCode} - ${item.courseName}`);
  const speakerText = item.speakerRole ? `${item.lecturer} (${item.speakerRole})` : item.lecturer;
  const divisionText = item.divisionName ? `Divisi: ${item.divisionName}\n` : '';
  const details = encodeURIComponent(
    `${divisionText}Pembicara: ${speakerText}\nRuang: ${item.room}\nMode: ${item.classType}\nCatatan: ${item.notes || ''}\nODP IT BNI Class Management`
  );
  const location = encodeURIComponent(`${item.room}, ${item.building}`);
  const dates = `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`;
  const recur = encodeURIComponent(`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}&recur=${recur}`;
}

/**
 * Generate direct Google Calendar URL for a deadline/reminder
 */
export function getGoogleCalendarUrlForReminder(reminder: ReminderItem): string {
  const deadlineDate = new Date(reminder.deadline);
  const startDate = new Date(deadlineDate.getTime() - 60 * 60 * 1000); // 1 hour before deadline

  const title = encodeURIComponent(`[DEADLINE] ${reminder.title} (${reminder.courseName})`);
  const details = encodeURIComponent(
    `Jenis: ${reminder.reminderType.toUpperCase()}\nMata Kuliah: ${reminder.courseName}\nKeterangan: ${reminder.description}\nPrioritas: ${reminder.priority}\nUniClass Hub Reminder`
  );
  const dates = `${formatGoogleDate(startDate)}/${formatGoogleDate(deadlineDate)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}`;
}

/**
 * Trigger download of .ics file to user's device (Android / iOS / PC)
 */
export function downloadICSFile(content: string, filename = 'jadwal-kuliah.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
