import { ScheduleItem, Announcement, ReminderItem, StudentMember } from '../types';

export const ASSET_IMAGES = {
  superAdminAvatar: '/src/assets/images/avatar_super_admin_1793850439093.jpg',
  classAdminAvatar: '/src/assets/images/avatar_class_admin_1793850441033.jpg',
  classMemberAvatar: '/src/assets/images/avatar_class_member_1793850441342.jpg',
  campusHeroBanner: '/src/assets/images/campus_hero_banner_1793850439712.jpg',
};

export const INITIAL_SCHEDULES: ScheduleItem[] = [];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];

export const INITIAL_REMINDERS: ReminderItem[] = [];

export const CLASS_STUDENTS: StudentMember[] = [];

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Senin', short: 'Sen' },
  { value: 2, label: 'Selasa', short: 'Sel' },
  { value: 3, label: 'Rabu', short: 'Rab' },
  { value: 4, label: 'Kamis', short: 'Kam' },
  { value: 5, label: 'Jumat', short: 'Jum' },
  { value: 6, label: 'Sabtu', short: 'Sab' },
  { value: 7, label: 'Minggu', short: 'Min' },
];
