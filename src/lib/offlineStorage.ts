import { ScheduleItem, Announcement, ReminderItem, ReadReceipt, UserProfile, StudentMember, UserRole, PendingUserApproval } from '../types';
import { INITIAL_SCHEDULES, INITIAL_ANNOUNCEMENTS, INITIAL_REMINDERS, CLASS_STUDENTS } from './seedData';

const STORAGE_KEYS = {
  SCHEDULES: 'uniclass_schedules',
  ANNOUNCEMENTS: 'uniclass_announcements',
  REMINDERS: 'uniclass_reminders',
  READ_RECEIPTS: 'uniclass_read_receipts',
  USER_PROFILE: 'uniclass_user_profile',
  SIMULATED_OFFLINE: 'uniclass_simulated_offline',
  CLASS_MEMBERS: 'uniclass_class_members',
  PENDING_APPROVALS: 'uniclass_pending_approvals',
  DATA_VERSION: 'uniclass_data_clean_version',
};

// IDs of previously seeded dummy items to ensure they are purged
const DUMMY_SCHEDULE_IDS = new Set(['sch-1', 'sch-2', 'sch-3', 'sch-4', 'sch-5']);
const DUMMY_ANNOUNCEMENT_IDS = new Set(['ann-1', 'ann-2', 'ann-3']);
const DUMMY_REMINDER_IDS = new Set(['rem-1', 'rem-2', 'rem-3']);
const DUMMY_MEMBER_IDS = new Set(['mhs-2', 'mhs-3', 'mhs-4', 'mhs-5', 'mhs-6']);

export const offlineStorage = {
  purgeLegacyDummyData() {
    try {
      const v = localStorage.getItem(STORAGE_KEYS.DATA_VERSION);
      if (v !== '2.0_no_dummy') {
        const scheds = this.getSchedules();
        this.saveSchedules(scheds.filter(s => !DUMMY_SCHEDULE_IDS.has(s.id)));

        const anns = this.getAnnouncements();
        this.saveAnnouncements(anns.filter(a => !DUMMY_ANNOUNCEMENT_IDS.has(a.id)));

        const rems = this.getReminders();
        this.saveReminders(rems.filter(r => !DUMMY_REMINDER_IDS.has(r.id)));

        const members = this.getClassMembers();
        this.saveClassMembers(members.filter(m => !DUMMY_MEMBER_IDS.has(m.id)));

        localStorage.setItem(STORAGE_KEYS.DATA_VERSION, '2.0_no_dummy');
      }
    } catch (e) {
      console.warn('Error purging legacy dummy data:', e);
    }
  },

  getSchedules(): ScheduleItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(s => !DUMMY_SCHEDULE_IDS.has(s.id));
          if (clean.length !== parsed.length) {
            this.saveSchedules(clean);
          }
          return clean;
        }
      }
    } catch (e) {
      console.warn('Error reading schedules from localStorage', e);
    }
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
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(a => !DUMMY_ANNOUNCEMENT_IDS.has(a.id));
          if (clean.length !== parsed.length) {
            this.saveAnnouncements(clean);
          }
          return clean;
        }
      }
    } catch (e) {
      console.warn('Error reading announcements from localStorage', e);
    }
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
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(r => !DUMMY_REMINDER_IDS.has(r.id));
          if (clean.length !== parsed.length) {
            this.saveReminders(clean);
          }
          return clean;
        }
      }
    } catch (e) {
      console.warn('Error reading reminders from localStorage', e);
    }
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
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(m => !DUMMY_MEMBER_IDS.has(m.id));
          if (clean.length !== parsed.length) {
            this.saveClassMembers(clean);
          }
          return clean;
        }
      }
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

  getPendingApprovals(): PendingUserApproval[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PENDING_APPROVALS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Error reading pending approvals', e);
    }
    return [];
  },

  savePendingApprovals(approvals: PendingUserApproval[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_APPROVALS, JSON.stringify(approvals));
      window.dispatchEvent(new Event('pending-approvals-changed'));
    } catch (e) {
      console.warn('Error saving pending approvals', e);
    }
  },

  addPendingApproval(req: { uid: string; email: string; displayName: string; avatarUrl?: string }): PendingUserApproval {
    const current = this.getPendingApprovals();
    const normalizedEmail = req.email.trim().toLowerCase();
    const existing = current.find(p => p.email.toLowerCase() === normalizedEmail);
    if (existing) {
      return existing;
    }
    const newApproval: PendingUserApproval = {
      id: `req-${Date.now()}`,
      uid: req.uid,
      email: normalizedEmail,
      displayName: req.displayName || req.email.split('@')[0],
      avatarUrl: req.avatarUrl,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    const updated = [newApproval, ...current];
    this.savePendingApprovals(updated);
    return newApproval;
  },

  approveUserAccess(id: string, role: UserRole, nim: string, approvedBy: string): StudentMember | null {
    const current = this.getPendingApprovals();
    const target = current.find(p => p.id === id);
    if (!target) return null;

    // Remove from pending
    const updatedPending = current.filter(p => p.id !== id);
    this.savePendingApprovals(updatedPending);

    // Add to class members roster
    const newMember: StudentMember = {
      id: target.uid || `mhs-${Date.now()}`,
      name: target.displayName,
      nim: nim || `ODP-IT-2026-${Math.floor(100 + Math.random() * 900)}`,
      email: target.email,
      avatarUrl: target.avatarUrl || '',
      attendanceRate: 100,
      lastActive: 'Baru saja dikonfirmasi',
      role,
      status: 'active',
    };

    const members = this.getClassMembers();
    const updatedMembers = [...members.filter(m => m.email.toLowerCase() !== target.email.toLowerCase()), newMember];
    this.saveClassMembers(updatedMembers);

    return newMember;
  },

  rejectUserAccess(id: string, rejectedBy: string) {
    const current = this.getPendingApprovals();
    const updated = current.filter(p => p.id !== id);
    this.savePendingApprovals(updated);
  },
};

// Immediately run legacy dummy data purge
offlineStorage.purgeLegacyDummyData();
