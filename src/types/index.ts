export type UserRole = 'super_admin' | 'class_admin' | 'class_member';

export interface RolePermissionInfo {
  role: UserRole;
  label: string;
  badgeColor: string;
  description: string;
  canManageRoles: boolean;
  canManageSettings: boolean;
  canManageDatabase: boolean;
  canManageSchedules: boolean;
  canManageAnnouncements: boolean;
  canManageReminders: boolean;
  isReadOnly: boolean;
}

export const ROLE_DEFINITIONS: Record<UserRole, RolePermissionInfo> = {
  super_admin: {
    role: 'super_admin',
    label: 'Super Admin',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Akses penuh aplikasi, pengelolaan menu Pengaturan (Settings), konfigurasi database, dan Manajemen Role seluruh anggota kelas.',
    canManageRoles: true,
    canManageSettings: true,
    canManageDatabase: true,
    canManageSchedules: true,
    canManageAnnouncements: true,
    canManageReminders: true,
    isReadOnly: false,
  },
  class_admin: {
    role: 'class_admin',
    label: 'Admin Kelas (Ketua Kelas)',
    badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    description: 'Ketua kelas / perwakilan kelas yang berhak mengirim, memperbarui, dan mengedit semua jadwal perkuliahan, siaran berita/pengumuman, serta pengingat tenggat waktu.',
    canManageRoles: false,
    canManageSettings: false,
    canManageDatabase: false,
    canManageSchedules: true,
    canManageAnnouncements: true,
    canManageReminders: true,
    isReadOnly: false,
  },
  class_member: {
    role: 'class_member',
    label: 'Member Kelas (Mahasiswa)',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Mahasiswa / anggota kelas biasa dengan akses baca untuk melihat beranda, jadwal kuliah, siaran berita kelas, dan pengingat tugas.',
    canManageRoles: false,
    canManageSettings: false,
    canManageDatabase: false,
    canManageSchedules: false,
    canManageAnnouncements: false,
    canManageReminders: false,
    isReadOnly: true,
  },
};

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status?: 'active' | 'pending' | 'rejected';
  nim?: string;
  major?: string;
  avatarUrl?: string;
  createdAt: string;
}

export type ClassType = 'offline' | 'online' | 'hybrid';

export interface ScheduleItem {
  id: string;
  classId?: string;
  courseName: string; // Topik / Materi Sesi ODP
  courseCode: string; // Kode Sesi / Modul (e.g. ODP-EAS-01)
  lecturer: string;   // Nama Pembicara
  divisionName?: string; // Nama Divisi BNI
  speakerRole?: string; // Jabatan: Dept Head / Team Leader
  dayOfWeek: number; // 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
  startTime: string; // "08:30"
  endTime: string;   // "11:30"
  room: string;      // Ruang Kelas yang digunakan
  building: string;  // Gedung / Kampus BNI
  classType: ClassType;
  notes?: string;
  updatedAt?: string;
}

export const BNI_IT_DIVISIONS = [
  'Divisi Enterprise Architecture & Strategy (EAS)',
  'Divisi Information Security & Cyber Defense (ISC)',
  'Divisi Digital Banking Product & Platform (DBP)',
  'Divisi Core Banking & Payment Systems (CPS)',
  'Divisi Data Analytics, AI & Big Data (DAB)',
  'Divisi IT Infrastructure & Cloud Operations (ICO)',
  'Divisi IT Quality Assurance & Governance (QAG)',
  'Divisi Open Banking & API Integration (OAP)',
];

export const BNI_SPEAKER_ROLES = [
  'Department Head (Dept Head)',
  'Team Leader',
  'Vice President (VP)',
  'Lead Solution Architect',
  'Principal System Engineer',
];

export const BNI_TRAINING_ROOMS = [
  'Ruang Sinabung Lt. 3 - BNI Corpu Jakarta',
  'Ruang Rinjani Lt. 2 - BNI Corpu Jakarta',
  'Ruang Bromo Lt. 4 - BNI Corpu Jakarta',
  'Innovation Lab - Graha BNI Sudirman Lt. 15',
  'Auditorium Utama Corpu Lt. 1',
  'Virtual Class (Zoom Meeting BNI Corpu)',
];

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
  role: UserRole;
  status?: 'active' | 'pending' | 'rejected';
}

export interface PendingUserApproval {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  assignedRole?: UserRole;
  assignedNim?: string;
  decisionBy?: string;
  decisionAt?: string;
}

export type DeviceViewMode = 'mobile-ios' | 'mobile-android' | 'portal-web';
