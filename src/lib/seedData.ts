import { ScheduleItem, Announcement, ReminderItem, StudentMember } from '../types';

export const ASSET_IMAGES = {
  superAdminAvatar: '/src/assets/images/avatar_super_admin_1793850439093.jpg',
  classAdminAvatar: '/src/assets/images/avatar_class_admin_1793850441033.jpg',
  classMemberAvatar: '/src/assets/images/avatar_class_member_1793850441342.jpg',
  campusHeroBanner: '/src/assets/images/campus_hero_banner_1793850439712.jpg',
};

// No dummy data: Real schedules will be fetched from the private API or added via Portal
export const INITIAL_SCHEDULES: ScheduleItem[] = [];

// No dummy data: Announcements will be loaded from the private API
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];

// No dummy data: Reminders will be loaded from the private API
export const INITIAL_REMINDERS: ReminderItem[] = [];

// Roster: Only the official Super Admin account; other members load from private API
export const CLASS_STUDENTS: StudentMember[] = [
  {
    id: 'usr-admin-1',
    name: 'Luki Giovani',
    nim: 'NIP: BNI-CORPU-019',
    email: 'LukiGio23@gmail.com',
    avatarUrl: ASSET_IMAGES.superAdminAvatar,
    attendanceRate: 100,
    lastActive: 'Aktif',
    role: 'super_admin',
  },
];

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Senin', short: 'Sen' },
  { value: 2, label: 'Selasa', short: 'Sel' },
  { value: 3, label: 'Rabu', short: 'Rab' },
  { value: 4, label: 'Kamis', short: 'Kam' },
  { value: 5, label: 'Jumat', short: 'Jum' },
  { value: 6, label: 'Sabtu', short: 'Sab' },
  { value: 7, label: 'Minggu', short: 'Min' },
];
