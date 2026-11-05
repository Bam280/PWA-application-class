import { ScheduleItem, Announcement, ReminderItem, ReadReceipt, UserProfile, StudentMember, UserRole } from '../types';
import { INITIAL_SCHEDULES, INITIAL_ANNOUNCEMENTS, INITIAL_REMINDERS, CLASS_STUDENTS } from './seedData';

const STORAGE_KEYS = {
  SCHEDULES: 'uniclass_schedules',
  ANNOUNCEMENTS: 'uniclass_announcements',
  REMINDERS: 'uniclass_reminders',
  READ_RECEIPTS: 'uniclass_read_receipts',
  USER_PROFILE: 'uniclass_user_profile',
  SIMULATED_OFFLINE: 'uniclass_simulated_offline',
  CLASS_MEMBERS: 'uniclass_class_members',
};

export const offlineStorage = {
  getSchedules(): ScheduleItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading schedules from localStorage', e);
    }
    this.saveSchedules(INITIAL_SCHEDULES);
    return INITIAL_SCHEDULES;
  },

  saveSchedules(schedules: ScheduleItem[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
    } catch (e) {
      console.warn('Error saving schedules', e);
    }
  },

  getAnnouncements(): Announcement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading announcements from localStorage', e);
    }
    this.saveAnnouncements(INITIAL_ANNOUNCEMENTS);
    return INITIAL_ANNOUNCEMENTS;
  },

  saveAnnouncements(announcements: Announcement[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(announcements));
    } catch (e) {
      console.warn('Error saving announcements', e);
    }
  },

  getReminders(): ReminderItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REMINDERS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading reminders from localStorage', e);
    }
    this.saveReminders(INITIAL_REMINDERS);
    return INITIAL_REMINDERS;
  },

  saveReminders(reminders: ReminderItem[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
    } catch (e) {
      console.warn('Error saving reminders', e);
    }
  },

  getReadReceipts(): ReadReceipt[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.READ_RECEIPTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveReadReceipt(receipt: ReadReceipt) {
    try {
      const current = this.getReadReceipts();
      const exists = current.some(
        r => r.announcementId === receipt.announcementId && r.userId === receipt.userId
      );
      if (!exists) {
        current.push(receipt);
        localStorage.setItem(STORAGE_KEYS.READ_RECEIPTS, JSON.stringify(current));
      }
    } catch (e) {
      console.warn('Error saving read receipt', e);
    }
  },

  getClassMembers(): StudentMember[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLASS_MEMBERS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading class members', e);
    }
    this.saveClassMembers(CLASS_STUDENTS);
    return CLASS_STUDENTS;
  },

  saveClassMembers(members: StudentMember[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.CLASS_MEMBERS, JSON.stringify(members));
      window.dispatchEvent(new Event('class-members-changed'));
    } catch (e) {
      console.warn('Error saving class members', e);
    }
  },

  updateMemberRole(memberId: string, newRole: UserRole): StudentMember[] {
    const members = this.getClassMembers();
    const updated = members.map(m => (m.id === memberId ? { ...m, role: newRole } : m));
    this.saveClassMembers(updated);
    return updated;
  },

  getUserProfile(): UserProfile | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  saveUserProfile(profile: UserProfile | null) {
    try {
      if (profile) {
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      }
    } catch (e) {
      console.warn('Error saving user profile', e);
    }
  },

  getSimulatedOffline(): boolean {
    return localStorage.getItem(STORAGE_KEYS.SIMULATED_OFFLINE) === 'true';
  },

  setSimulatedOffline(val: boolean) {
    localStorage.setItem(STORAGE_KEYS.SIMULATED_OFFLINE, String(val));
    window.dispatchEvent(new Event('offline-status-changed'));
  },

  isAppOnline(): boolean {
    if (this.getSimulatedOffline()) return false;
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  },
};
