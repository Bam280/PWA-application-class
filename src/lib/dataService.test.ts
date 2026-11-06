import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeApiUrl,
  extractApiErrorDetail,
  toApiAnnouncement,
  toApiSchedule,
  toApiReminder,
  formatScheduleTime,
  toDatetimeLocalValue,
  sameApiRows,
  describeScheduleChanges,
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

test('extractApiErrorDetail reads the message and per-field details', () => {
  assert.equal(extractApiErrorDetail({ message: 'Data tidak valid' }), 'Data tidak valid');
  assert.equal(extractApiErrorDetail({ error: 'Ditolak' }), 'Ditolak');
  assert.equal(
    extractApiErrorDetail({ message: 'Data tidak valid', errors: [{ path: 'classId', msg: 'wajib diisi' }] }),
    'Data tidak valid - classId: wajib diisi'
  );
  assert.equal(
    extractApiErrorDetail({ message: 'Invalid', errors: { title: ['required', 'too short'], room: 'required' } }),
    'Invalid - title: required, too short; room: required'
  );
  assert.equal(
    extractApiErrorDetail({ issues: [{ path: ['author', 'id'], message: 'Required' }] }),
    'author.id: Required'
  );
  assert.equal(
    extractApiErrorDetail({ error: { message: 'Bad', details: [{ field: 'day', reason: 'range' }] } }),
    'Bad - day: range'
  );
  assert.equal(extractApiErrorDetail(null), '');
  assert.equal(extractApiErrorDetail({ ok: false }), '');
});

test('request bodies contain only the fields the API accepts', () => {
  assert.deepEqual(toApiAnnouncement({ title: 'A', content: 'B', readCount: 0 }), { title: 'A', content: 'B', reads: 0 });
  assert.deepEqual(
    toApiSchedule({ courseName: 'Jaringan Komputer', dayOfWeek: 1, startTime: '08:00', room: 'Lab 3' }),
    { title: 'Jaringan Komputer', day: 'Senin', time: '08:00', room: 'Lab 3' }
  );
  assert.deepEqual(
    toApiSchedule({ courseName: 'Basis Data', dayOfWeek: 5, startTime: '13:00', room: '' }),
    { title: 'Basis Data', day: 'Jumat', time: '13:00' }
  );
  assert.deepEqual(
    toApiReminder({ title: 'Laporan', deadline: '2026-11-10T16:59:00.000Z', isCompleted: false }),
    { task: 'Laporan', time: '2026-11-10T16:59:00.000Z', completed: false }
  );
});

test('rows from the API are read back without invented values', () => {
  const sch = normalizeSchedule({ id: 'u1', title: 'Jaringan Komputer', day: 'Rabu', time: '13:00', room: 'Lab 3' });
  assert.equal(sch.id, 'u1');
  assert.equal(sch.courseName, 'Jaringan Komputer');
  assert.equal(sch.dayOfWeek, 3);
  assert.equal(sch.startTime, '13:00');
  assert.equal(sch.endTime, '13:00');
  assert.equal(sch.room, 'Lab 3');
  assert.equal(sch.building, '');
  assert.equal(sch.lecturer, '');
  assert.equal(sch.courseCode, '');
  assert.equal(formatScheduleTime(sch), '13:00');
  assert.equal(formatScheduleTime({ startTime: '08:00', endTime: '10:00' }), '08:00 - 10:00');

  const ann = normalizeAnnouncement({ id: 'u2', title: 'A', content: 'B', reads: 7, createdAt: '2026-11-06T03:32:00.000Z' });
  assert.equal(ann.id, 'u2');
  assert.equal(ann.readCount, 7);
  assert.equal(ann.publishedAt, '2026-11-06T03:32:00.000Z');

  const rem = normalizeReminder({ id: 'u3', task: 'Laporan', time: '2026-11-10T23:59:00+07:00', completed: true });
  assert.equal(rem.id, 'u3');
  assert.equal(rem.title, 'Laporan');
  assert.equal(rem.deadline, '2026-11-10T23:59:00+07:00');
  assert.equal(rem.isCompleted, true);
  assert.equal(rem.courseName, '');
});

test('toDatetimeLocalValue produces the local value a datetime-local input can show', () => {
  const iso = new Date(2026, 10, 10, 23, 59).toISOString();
  assert.equal(toDatetimeLocalValue(iso), '2026-11-10T23:59');
  assert.equal(toDatetimeLocalValue('bukan tanggal'), 'bukan tanggal');
});

test('sameApiRows ignores generated timestamps but sees real changes', () => {
  const row = { id: '1', title: 'A', updatedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' };
  assert.equal(sameApiRows([row], [{ ...row, updatedAt: '2026-06-06T00:00:00Z' }]), true);
  assert.equal(sameApiRows([row], [{ ...row, title: 'B' }]), false);
  assert.equal(sameApiRows([row], []), false);
});

test('describeScheduleChanges reports edits and removals, and ignores new or unchanged rows', () => {
  const a = normalizeSchedule({ id: 'a', title: 'Basis Data', day: 'Senin', time: '08:00', room: 'Lab 1' });
  const b = normalizeSchedule({ id: 'b', title: 'Jaringan', day: 'Rabu', time: '10:00', room: 'Lab 2' });
  const c = normalizeSchedule({ id: 'c', title: 'Sistem Operasi', day: 'Jumat', time: '13:00' });
  const aMoved = normalizeSchedule({ id: 'a', title: 'Basis Data', day: 'Selasa', time: '09:00', room: 'Lab 1' });
  const fresh = normalizeSchedule({ id: 'd', title: 'Baru', day: 'Kamis', time: '07:00' });

  const { changed, removed } = describeScheduleChanges([a, b, c], [aMoved, c, fresh]);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].item.id, 'a');
  assert.equal(changed[0].details, 'Hari: Senin → Selasa · Jam: 08:00 → 09:00');
  assert.deepEqual(removed.map(r => r.id), ['b']);
});
