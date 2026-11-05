import test from 'node:test';
import assert from 'node:assert/strict';
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

  // Check Thursday (dayOfWeek 4) has mock schedule
  const thursdays = weeks.flatMap((w) => w.days.filter((d) => d.dayOfWeek === 4 && d.isCurrentMonth));
  assert.ok(thursdays.length >= 4);
  for (const th of thursdays) {
    assert.equal(th.hasSchedule, true);
    assert.equal(th.scheduleCount, 1);
  }
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
