export type UserRole = 'student' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  nim?: string;
  major?: string;
  avatarUrl?: string;
  createdAt: string;
}

export type ClassType = 'offline' | 'online' | 'hybrid';

export interface ScheduleItem {
  id: string;
  classId?: string;
  courseName: string;
  courseCode: string;
  lecturer: string;
  dayOfWeek: number; // 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
  startTime: string; // "08:00"
  endTime: string;   // "09:40"
  room: string;
  building: string;
  classType: ClassType;
  notes?: string;
  updatedAt?: string;
}

export type Priority = 'normal' | 'important' | 'urgent';
export type AnnouncementCategory = 'academic' | 'exam' | 'event' | 'schedule_change';

export interface Announcement {
  id: string;
  classId?: string;
  title: string;
  content: string;
  priority: Priority;
  category: AnnouncementCategory;
  authorId: string;
  authorName: string;
  publishedAt: string;
  readCount: number;
  totalStudents?: number;
  attachmentName?: string;
  attachmentUrl?: string;
}

export type ReminderType = 'assignment' | 'quiz' | 'exam' | 'project';

export interface ReminderItem {
  id: string;
  classId?: string;
  title: string;
  courseName: string;
  deadline: string; // ISO string e.g. "2026-11-08T23:59:00"
  reminderType: ReminderType;
  description: string;
  priority: 'low' | 'medium' | 'high';
  isCompleted?: boolean;
  createdAt?: string;
}

export interface ReadReceipt {
  id: string;
  announcementId: string;
  userId: string;
  userName: string;
  userEmail: string;
  readAt: string;
  deviceType?: string;
}

export interface StudentMember {
  id: string;
  name: string;
  nim: string;
  email: string;
  avatarUrl: string;
  attendanceRate: number;
  lastActive: string;
}

export type DeviceViewMode = 'mobile-ios' | 'mobile-android' | 'portal-web';
