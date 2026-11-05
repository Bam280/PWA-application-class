import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeApiUrl,
  extractArrayPayload,
  normalizeSchedule,
  normalizeAnnouncement,
  normalizeReminder,
  normalizeStudentMember,
} from './dataService';

test('normalizeApiUrl handles localhost, IPs, and full URLs gracefully', () => {
  assert.equal(normalizeApiUrl('localhost:8000/api'), 'http://localhost:8000/api');
  assert.equal(normalizeApiUrl('127.0.0.1:3000/api/v1/'), 'http://127.0.0.1:3000/api/v1');
  assert.equal(normalizeApiUrl('192.168.1.50:8080/'), 'http://192.168.1.50:8080');
  assert.equal(normalizeApiUrl('https://api.kampus-pribadi.ac.id/v1/'), 'https://api.kampus-pribadi.ac.id/v1');
  assert.equal(normalizeApiUrl('  "https://api.domain.com/rest"  '), 'https://api.domain.com/rest');
  assert.equal(normalizeApiUrl(''), '');
});

test('extractArrayPayload extracts arrays from various REST API envelopes', () => {
  const rawList = [{ id: '1' }, { id: '2' }];
  assert.deepEqual(extractArrayPayload(rawList), rawList);
  assert.deepEqual(extractArrayPayload({ data: rawList }), rawList);
  assert.deepEqual(extractArrayPayload({ results: rawList }), rawList);
  assert.deepEqual(extractArrayPayload({ items: rawList }), rawList);
  assert.deepEqual(extractArrayPayload({ schedules: rawList }, ['schedules']), rawList);
  assert.deepEqual(extractArrayPayload(null), []);
  assert.deepEqual(extractArrayPayload({ error: 'not found' }), []);
});

test('normalizeSchedule converts snake_case and missing fields into safe ScheduleItem', () => {
  const snakeInput = {
    course_name: 'Pemrograman Web Lanjut',
    course_code: 'IF-401',
    day_of_week: 'Selasa',
    start_time: '09:00',
    end_time: '11:30',
    ruangan: 'Lab 204',
    gedung: 'BNI Corpu Lantai 3',
    speaker: 'Bpk. Hendra',
    speaker_role: 'Dosen Pembimbing',
    division_name: 'Informatika',
  };

  const normalized = normalizeSchedule(snakeInput);
  assert.equal(normalized.courseName, 'Pemrograman Web Lanjut');
  assert.equal(normalized.courseCode, 'IF-401');
  assert.equal(normalized.dayOfWeek, 2); // 'Selasa' mapped to 2
  assert.equal(normalized.startTime, '09:00');
  assert.equal(normalized.endTime, '11:30');
  assert.equal(normalized.room, 'Lab 204');
  assert.equal(normalized.building, 'BNI Corpu Lantai 3');
  assert.equal(normalized.lecturer, 'Bpk. Hendra');
  assert.equal(normalized.speakerRole, 'Dosen Pembimbing');
  assert.equal(normalized.divisionName, 'Informatika');
  assert.ok(normalized.id.length > 0);
});

test('normalizeAnnouncement safely parses snake_case data', () => {
  const raw = {
    judul: 'Ujian Tengah Semester',
    isi: 'Jadwal UTS telah diumumkan.',
    published_at: '2026-11-05T10:00:00Z',
    author_name: 'Kaprodi',
    read_count: 35,
    prioritas: 'important',
  };

  const ann = normalizeAnnouncement(raw);
  assert.equal(ann.title, 'Ujian Tengah Semester');
  assert.equal(ann.content, 'Jadwal UTS telah diumumkan.');
  assert.equal(ann.authorName, 'Kaprodi');
  assert.equal(ann.readCount, 35);
  assert.equal(ann.priority, 'important');
  assert.equal(ann.category, 'academic');
});

test('normalizeReminder safely parses snake_case data', () => {
  const raw = {
    judul: 'Tugas Cloud Architecture',
    course_name: 'Cloud Computing',
    batas_waktu: '2026-11-10T23:59:00Z',
    is_completed: true,
    tipe: 'tugas',
  };

  const rem = normalizeReminder(raw);
  assert.equal(rem.title, 'Tugas Cloud Architecture');
  assert.equal(rem.courseName, 'Cloud Computing');
  assert.equal(rem.isCompleted, true);
  assert.equal(rem.reminderType, 'assignment');
});

test('normalizeStudentMember safely handles member fields', () => {
  const raw = {
    nama: 'Budi Santoso',
    nim: '2301092001',
    email: 'budi@kampus.ac.id',
    peran: 'class_admin',
    attendance_rate: 98,
  };

  const member = normalizeStudentMember(raw);
  assert.equal(member.name, 'Budi Santoso');
  assert.equal(member.nim, '2301092001');
  assert.equal(member.email, 'budi@kampus.ac.id');
  assert.equal(member.role, 'class_admin');
  assert.equal(member.attendanceRate, 98);
});
