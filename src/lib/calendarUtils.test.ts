import test from 'node:test';
import assert from 'node:assert/strict';
import { dayOfWeekOf, getWeekDays, parseDateKey, toDateKey } from './calendarUtils';
import { generateSchedulesICS, getGoogleCalendarUrlForSchedule } from './calendarSync';
import {
  getMonthCalendarWeeks,
  calculateAcademicWeek,
  isSameDay,
  formatFullIndonesianDate,
  getDateInWeek,
  getGoogleCalendarUrlForDateSchedule,
} from './calendarUtils';
import { ScheduleItem } from '../types';

test('isSameDay correctly identifies identical dates', () => {
  const d1 = new Date(2026, 10, 5, 10, 0); // 5 Nov 2026
  const d2 = new Date(2026, 10, 5, 23, 59); // 5 Nov 2026
  const d3 = new Date(2026, 10, 6, 0, 1);   // 6 Nov 2026

  assert.equal(isSameDay(d1, d2), true);
  assert.equal(isSameDay(d1, d3), false);
});

test('calculateAcademicWeek returns valid week number between 1 and 16', () => {
  const nov2026 = new Date(2026, 10, 5); // November is ~week 9-11 in odd semester
  const weekNum = calculateAcademicWeek(nov2026);
  assert.ok(weekNum >= 1 && weekNum <= 16, `Week should be between 1 and 16, got ${weekNum}`);
});

test('getMonthCalendarWeeks generates valid week structures for November 2026', () => {
  const mockSchedules: ScheduleItem[] = [
    {
      id: 'sch-1',
      courseName: 'Basis Data',
      courseCode: 'IF-312',
      lecturer: 'Dosen A',
      date: '2026-11-12',
      dayOfWeek: 4, // Kamis
      startTime: '08:00',
      endTime: '10:30',
      room: 'Lab 302',
      building: 'Fasilkom',
      classType: 'offline',
    },
  ];

  const weeks = getMonthCalendarWeeks(2026, 10, mockSchedules, []);
  assert.ok(weeks.length >= 4 && weeks.length <= 6, `Weeks count should be 4-6, got ${weeks.length}`);

  // Each week must have exactly 7 days (Monday to Sunday)
  for (const w of weeks) {
    assert.equal(w.days.length, 7, 'Each week must have 7 days');
    assert.equal(w.days[0].dayOfWeek, 1, 'First day must be Monday');
    assert.equal(w.days[6].dayOfWeek, 7, 'Last day must be Sunday');
  }

  // Only 12 Nov has the session; the other Thursdays stay empty.
  const days = weeks.flatMap((w) => w.days);
  const withSchedule = days.filter((d) => d.hasSchedule);
  assert.equal(withSchedule.length, 1);
  assert.equal(withSchedule[0].dayNumber, 12);
  assert.equal(withSchedule[0].scheduleCount, 1);
  assert.equal(weeks.reduce((sum, w) => sum + w.totalSchedules, 0), 1);
});

test('a schedule without a date is on no calendar day', () => {
  const noDate = { id: 'old', courseName: 'Lama', courseCode: '', lecturer: '', dayOfWeek: 1, startTime: '08:00', endTime: '10:00', room: '', building: '', classType: 'offline' } as ScheduleItem;
  const weeks = getMonthCalendarWeeks(2026, 10, [noDate], []);
  assert.equal(weeks.reduce((sum, w) => sum + w.totalSchedules, 0), 0);
});

test('parseDateKey and toDateKey use the local calendar date', () => {
  const date = parseDateKey('2026-11-10') as Date;
  assert.equal(date.getDate(), 10);
  assert.equal(date.getHours(), 0);
  assert.equal(dayOfWeekOf(date), 2);
  assert.equal(toDateKey(date), '2026-11-10');
  assert.equal(parseDateKey('Senin'), null);
  assert.equal(parseDateKey('2026-02-31'), null);
  assert.equal(parseDateKey(undefined), null);
});

test('getWeekDays starts on Monday, also from a Sunday', () => {
  const days = getWeekDays(new Date(2026, 10, 8)); // Sunday 8 Nov
  assert.equal(toDateKey(days[0]), '2026-11-02');
  assert.equal(toDateKey(days[6]), '2026-11-08');
  assert.equal(toDateKey(getWeekDays(new Date(2026, 10, 8), 1)[0]), '2026-11-09');
});

test('calendar exports hold one event on the date, without repeating', () => {
  const dated = { id: 'd', courseName: 'Sesi', courseCode: '', lecturer: '', date: '2026-11-10', dayOfWeek: 2, startTime: '09:00', endTime: '11:00', room: 'R', building: 'G', classType: 'offline' } as ScheduleItem;
  const old = { ...dated, id: 'old', date: undefined };
  const ics = generateSchedulesICS([dated, old]);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 1);
  assert.ok(!ics.includes('RRULE'));
  assert.ok(ics.includes(`DTSTART:${new Date(2026, 10, 10, 9).toISOString().replace(/[-:]|\.\d{3}/g, '')}`));
  assert.ok(!getGoogleCalendarUrlForSchedule(dated).includes('recur='));
});

test('getDateInWeek returns correct date for Monday of selected week', () => {
  const weeks = getMonthCalendarWeeks(2026, 10, [], []);
  const week1 = weeks[0];
  const monday = getDateInWeek(week1, 1);
  assert.equal(monday.getDay(), 1, 'Monday should have getDay() === 1');
});

test('getGoogleCalendarUrlForDateSchedule encodes date properly', () => {
  const mockSchedule: ScheduleItem = {
    id: 'sch-test',
    courseName: 'Pemrograman Web',
    courseCode: 'IF-201',
    lecturer: 'Dosen Web',
    dayOfWeek: 2,
    startTime: '09:00',
    endTime: '11:30',
    room: 'Lab 1',
    building: 'Gedung A',
    classType: 'offline',
  };
  const targetDate = new Date(2026, 10, 3); // 3 Nov 2026
  const url = getGoogleCalendarUrlForDateSchedule(mockSchedule, targetDate);
  assert.ok(url.includes('calendar.google.com'));
  assert.ok(url.includes('20261103T090000'));
  assert.ok(url.includes('IF-201'));
});

test('getGoogleCalendarUrlForDateSchedule handles missing/undefined startTime and dates gracefully without throwing', () => {
  const incompleteSchedule = {
    id: 'sch-partial',
    courseName: 'Cloud Computing',
    courseCode: 'CC-101',
  } as unknown as ScheduleItem;

  // Must not throw TypeError: Cannot read properties of undefined (reading 'replace')
  assert.doesNotThrow(() => {
    const url = getGoogleCalendarUrlForDateSchedule(incompleteSchedule, undefined);
    assert.ok(url.includes('calendar.google.com'));
    assert.ok(url.includes('CC-101'));
  });
});
