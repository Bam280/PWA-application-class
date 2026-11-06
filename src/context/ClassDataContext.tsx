import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ScheduleItem, Announcement, ReminderItem, ReadReceipt, StudentMember, UserRole, ROLE_DEFINITIONS, PendingUserApproval } from '../types';
import { offlineStorage } from '../lib/offlineStorage';
import { notificationService } from '../lib/notifications';
import { useAuth } from './AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { dataService, CustomDatabaseConfig } from '../lib/dataService';
import { roleApi, toStudentMember, RoleApiError, isRoleApiConfigured } from '../lib/roleApi';
import { ASSET_IMAGES } from '../lib/seedData';

interface ClassDataContextType {
  schedules: ScheduleItem[];
  announcements: Announcement[];
  reminders: ReminderItem[];
  readReceipts: ReadReceipt[];
  classMembers: StudentMember[];
  pendingApprovals: PendingUserApproval[];
  approvePendingUser: (id: string, role: UserRole, nim: string) => Promise<boolean>;
  rejectPendingUser: (id: string) => Promise<boolean>;
  loading: boolean;
  dbConfig: CustomDatabaseConfig;
  updateDbConfig: (cfg: CustomDatabaseConfig) => void;
  /** Error from the last roster load (role API), shown in the member management screens. */
  membersError: string | null;
  reloadMembers: () => Promise<void>;
  /** Roster changes go to the role API; each resolves to true on success. */
  updateMemberRole: (memberId: string, role: UserRole) => Promise<boolean>;
  addMember: (member: Omit<StudentMember, 'id'>) => Promise<boolean>;
  deleteMember: (memberId: string) => Promise<boolean>;
  addAnnouncement: (item: Omit<Announcement, 'id' | 'publishedAt' | 'readCount'>) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  markAnnouncementAsRead: (announcementId: string) => Promise<void>;
  addSchedule: (item: Omit<ScheduleItem, 'id'>) => Promise<void>;
  updateSchedule: (id: string, item: Partial<ScheduleItem>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  addReminder: (item: Omit<ReminderItem, 'id' | 'createdAt'>) => Promise<void>;
  updateReminder: (id: string, item: Partial<ReminderItem>) => Promise<void>;
  toggleReminderComplete: (id: string) => void;
  deleteReminder: (id: string) => Promise<void>;
  syncWithCloud: () => Promise<void>;
}

const ClassDataContext = createContext<ClassDataContextType | undefined>(undefined);

export const ClassDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, firebaseUser, isOnline, refreshAccess } = useAuth();
  // Firestore rules require request.auth; listeners must wait for (and follow) the Firebase session.
  const authUid = firebaseUser?.uid ?? null;
  const [dbConfig, setDbConfig] = useState<CustomDatabaseConfig>(() => dataService.getConfig());
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => offlineStorage.getSchedules());
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => offlineStorage.getAnnouncements());
  const [reminders, setReminders] = useState<ReminderItem[]>(() => offlineStorage.getReminders());
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>(() => offlineStorage.getReadReceipts());
  const [classMembers, setClassMembers] = useState<StudentMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingUserApproval[]>(() =>
    offlineStorage.getPendingApprovals()
  );
  const [loading, setLoading] = useState(false);
  const isAdminUser = user?.role === 'super_admin' || user?.role === 'class_admin';

  useEffect(() => {
    const handleApprovalsChange = () => {
      setPendingApprovals(offlineStorage.getPendingApprovals());
    };
    window.addEventListener('pending-approvals-changed', handleApprovalsChange);
    return () => window.removeEventListener('pending-approvals-changed', handleApprovalsChange);
  }, []);

  const reloadMembers = useCallback(async () => {
    if (!isAdminUser) {
      setClassMembers([]);
      setMembersError(null);
      return;
    }
    // If custom_api is configured with apiBaseUrl, fetch roster from the private API
    if (dbConfig.provider === 'custom_api' && dbConfig.apiBaseUrl) {
      try {
        const customMembers = await dataService.fetchFromCustomApi<StudentMember[]>('/users', dbConfig);
        if (customMembers && Array.isArray(customMembers)) {
          setClassMembers(customMembers);
          setMembersError(null);
          offlineStorage.saveClassMembers(customMembers);
          return;
        }
      } catch (e) {
        console.warn('Private API roster fetch notice:', e);
      }
    }
    // If external role API is configured via env, query it
    if (isRoleApiConfigured && isOnline) {
      try {
        const members = (await roleApi.listUsers()).map(toStudentMember);
        setClassMembers(members);
        setMembersError(null);
        offlineStorage.saveClassMembers(members);
        return;
      } catch (err) {
        console.warn('Role API roster load notice:', err);
      }
    }
    // Otherwise fallback to clean local roster
    setClassMembers(offlineStorage.getClassMembers());
    setMembersError(null);
  }, [isAdminUser, isOnline, dbConfig.provider, dbConfig.apiBaseUrl]);

  // Members only see their own data; admins load the roster for the signed-in account.
  useEffect(() => {
    reloadMembers();
  }, [reloadMembers, user?.id]);

  // Firestore & Custom API listeners when online
  useEffect(() => {
    if (!isOnline) {
      // Load offline cached data
      setSchedules(offlineStorage.getSchedules());
      setAnnouncements(offlineStorage.getAnnouncements());
      setReminders(offlineStorage.getReminders());
      setReadReceipts(offlineStorage.getReadReceipts());
      return;
    }

    // If provider is custom_api, fetch records from the personal backend API
    if (dbConfig.provider === 'custom_api' && dbConfig.apiBaseUrl) {
      (async () => {
        try {
          const [customScheds, customAnns, customRems, customUsers] = await Promise.all([
            dataService.fetchFromCustomApi<ScheduleItem[]>('/schedules', dbConfig),
            dataService.fetchFromCustomApi<Announcement[]>('/announcements', dbConfig),
            dataService.fetchFromCustomApi<ReminderItem[]>('/reminders', dbConfig),
            isAdminUser ? dataService.fetchFromCustomApi<StudentMember[]>('/users', dbConfig) : Promise.resolve(null),
          ]);
          if (customScheds && Array.isArray(customScheds)) {
            setSchedules(customScheds);
            offlineStorage.saveSchedules(customScheds);
          }
          if (customAnns && Array.isArray(customAnns)) {
            setAnnouncements(customAnns);
            offlineStorage.saveAnnouncements(customAnns);
          }
          if (customRems && Array.isArray(customRems)) {
            setReminders(customRems);
            offlineStorage.saveReminders(customRems);
          }
          if (customUsers && Array.isArray(customUsers)) {
            setClassMembers(customUsers);
            offlineStorage.saveClassMembers(customUsers);
          }
        } catch (e) {
          console.warn('Personal API data load notice:', e);
        }
      })();
    }

    // Without a Firebase session every Firestore read is denied; keep the local cache until sign-in.
    if (!authUid) return;

    // Schedules listener (for Firestore active provider or backup sync)
    const schedUnsub = onSnapshot(
      collection(db, 'schedules'),
      (snapshot) => {
        if (!snapshot.empty && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
          const items: ScheduleItem[] = snapshot.docs.map(d => ({
            ...(d.data() as Omit<ScheduleItem, 'id'>),
            id: d.id,
          }));
          setSchedules(items);
          offlineStorage.saveSchedules(items);
        }
      },
      (error) => {
        console.warn('Firestore schedules snapshot notice:', error.message);
      }
    );

    // Announcements listener
    const annUnsub = onSnapshot(
      query(collection(db, 'announcements'), orderBy('publishedAt', 'desc')),
      (snapshot) => {
        if (!snapshot.empty && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
          const items: Announcement[] = snapshot.docs.map(d => ({
            ...(d.data() as Omit<Announcement, 'id'>),
            id: d.id,
          }));
          setAnnouncements(items);
          offlineStorage.saveAnnouncements(items);
        }
      },
      (error) => {
        console.warn('Firestore announcements snapshot notice:', error.message);
      }
    );

    // Reminders listener
    const remUnsub = onSnapshot(
      collection(db, 'reminders'),
      (snapshot) => {
        if (!snapshot.empty && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
          const items: ReminderItem[] = snapshot.docs.map(d => ({
            ...(d.data() as Omit<ReminderItem, 'id'>),
            id: d.id,
          }));
          setReminders(items);
          offlineStorage.saveReminders(items);
        }
      },
      (error) => {
        console.warn('Firestore reminders snapshot notice:', error.message);
      }
    );

    // Pending approvals real-time listener for Super Admin
    let approvalsUnsub = () => {};
    if (isAdminUser && authUid) {
      try {
        approvalsUnsub = onSnapshot(
          collection(db, 'pending_approvals'),
          (snapshot) => {
            if (!snapshot.empty) {
              const remoteList: PendingUserApproval[] = snapshot.docs.map(d => ({
                id: d.id,
                uid: d.data().uid || d.id,
                email: d.data().email || '',
                displayName: d.data().displayName || '',
                avatarUrl: d.data().avatarUrl || undefined,
                requestedAt: d.data().requestedAt || new Date().toISOString(),
                status: 'pending',
              }));
              for (const req of remoteList) {
                offlineStorage.addPendingApproval(req);
              }
              setPendingApprovals(offlineStorage.getPendingApprovals());
            }
          },
          (err) => {
            console.warn('Pending approvals listener notice:', err.message);
          }
        );
      } catch (e) {
        console.warn('Error setting up pending approvals listener:', e);
      }
    }

    return () => {
      schedUnsub();
      annUnsub();
      remUnsub();
      approvalsUnsub();
    };
  }, [authUid, isOnline, isAdminUser, dbConfig.provider, dbConfig.apiBaseUrl, dbConfig.syncWithFirestoreBackup]);

  const addAnnouncement = async (item: Omit<Announcement, 'id' | 'publishedAt' | 'readCount'>) => {
    const newId = `ann-${Date.now()}`;
    const publishedAt = new Date().toISOString();
    const newAnnouncement: Announcement = {
      ...item,
      id: newId,
      publishedAt,
      readCount: 0,
      totalStudents: 42,
    };

    // Update local state and offline storage immediately
    const updated = [newAnnouncement, ...announcements];
    setAnnouncements(updated);
    offlineStorage.saveAnnouncements(updated);

    // Dispatch real-time push notification & sound chime
    notificationService.dispatchNotification(
      newAnnouncement.title,
      newAnnouncement.content.slice(0, 90) + '...',
      newAnnouncement.priority
    );

    // Sync to Custom API if provider is custom_api
    syncToCustomApi('/announcements', 'POST', newAnnouncement);

    // Sync to Firestore if online
    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await setDoc(doc(db, 'announcements', newId), newAnnouncement);
      } catch (err) {
        console.warn('Saved locally, Firestore sync pending:', err);
      }
    }
  };

  const deleteAnnouncement = async (id: string) => {
    const updated = announcements.filter(a => a.id !== id);
    setAnnouncements(updated);
    offlineStorage.saveAnnouncements(updated);

    syncToCustomApi(`/announcements/${id}`, 'DELETE');

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await deleteDoc(doc(db, 'announcements', id));
      } catch (err) {
        console.warn('Firestore delete error:', err);
      }
    }
  };

  const markAnnouncementAsRead = async (announcementId: string) => {
    if (!user) return;

    // Check if user already read this announcement
    const alreadyRead = readReceipts.some(
      r => r.announcementId === announcementId && r.userId === user.id
    );

    if (alreadyRead) return;

    const receipt: ReadReceipt = {
      id: `read-${announcementId}-${user.id}`,
      announcementId,
      userId: user.id,
      userName: user.displayName,
      userEmail: user.email,
      readAt: new Date().toISOString(),
    };

    // Update local receipts
    const updatedReceipts = [...readReceipts, receipt];
    setReadReceipts(updatedReceipts);
    offlineStorage.saveReadReceipt(receipt);

    // Increment read count in local announcement
    const updatedAnnouncements = announcements.map(a =>
      a.id === announcementId ? { ...a, readCount: (a.readCount || 0) + 1 } : a
    );
    setAnnouncements(updatedAnnouncements);
    offlineStorage.saveAnnouncements(updatedAnnouncements);

    syncToCustomApi(`/announcements/${announcementId}/reads`, 'POST', receipt);

    // Sync to Firestore subcollection if online
    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await setDoc(doc(db, 'announcements', announcementId, 'reads', user.id), receipt);
        await updateDoc(doc(db, 'announcements', announcementId), {
          readCount: increment(1),
        });
      } catch (err) {
        console.warn('Could not sync read receipt to Firestore:', err);
      }
    }
  };

  const addSchedule = async (item: Omit<ScheduleItem, 'id'>) => {
    const newId = `sch-${Date.now()}`;
    const newSchedule: ScheduleItem = {
      ...item,
      id: newId,
      updatedAt: new Date().toISOString(),
    };

    const updated = [...schedules, newSchedule];
    setSchedules(updated);
    offlineStorage.saveSchedules(updated);

    notificationService.dispatchNotification(
      'Jadwal Kuliah Diperbarui',
      `Jadwal baru ditambahkan: ${newSchedule.courseName} (${newSchedule.room})`,
      'normal'
    );

    syncToCustomApi('/schedules', 'POST', newSchedule);

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await setDoc(doc(db, 'schedules', newId), newSchedule);
      } catch (err) {
        console.warn('Schedule sync failed:', err);
      }
    }
  };

  const updateSchedule = async (id: string, item: Partial<ScheduleItem>) => {
    const updated = schedules.map(s => (s.id === id ? { ...s, ...item, updatedAt: new Date().toISOString() } : s));
    setSchedules(updated);
    offlineStorage.saveSchedules(updated);

    syncToCustomApi(`/schedules/${id}`, 'PUT', item);

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await updateDoc(doc(db, 'schedules', id), item);
      } catch (err) {
        console.warn('Schedule update failed:', err);
      }
    }
  };

  const deleteSchedule = async (id: string) => {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    offlineStorage.saveSchedules(updated);

    syncToCustomApi(`/schedules/${id}`, 'DELETE');

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
      } catch (err) {
        console.warn('Schedule delete failed:', err);
      }
    }
  };

  const addReminder = async (item: Omit<ReminderItem, 'id' | 'createdAt'>) => {
    const newId = `rem-${Date.now()}`;
    const newReminder: ReminderItem = {
      ...item,
      id: newId,
      createdAt: new Date().toISOString(),
      isCompleted: false,
    };

    const updated = [newReminder, ...reminders];
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    notificationService.dispatchNotification(
      `Pengingat Ditambahkan: ${newReminder.title}`,
      `Batas Waktu: ${new Date(newReminder.deadline).toLocaleDateString('id-ID')}`,
      'reminder'
    );

    syncToCustomApi('/reminders', 'POST', newReminder);

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await setDoc(doc(db, 'reminders', newId), newReminder);
      } catch (err) {
        console.warn('Reminder sync failed:', err);
      }
    }
  };

  const toggleReminderComplete = (id: string) => {
    const updated = reminders.map(r => (r.id === id ? { ...r, isCompleted: !r.isCompleted } : r));
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    const item = updated.find(r => r.id === id);
    if (item) {
      syncToCustomApi(`/reminders/${id}`, 'PUT', { isCompleted: item.isCompleted });
    }

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      if (item) {
        updateDoc(doc(db, 'reminders', id), { isCompleted: item.isCompleted }).catch(e =>
          console.warn('Error updating reminder status:', e)
        );
      }
    }
  };

  const updateReminder = async (id: string, item: Partial<ReminderItem>) => {
    const updated = reminders.map(r => (r.id === id ? { ...r, ...item } : r));
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    notificationService.dispatchNotification(
      'Pengingat Diperbarui',
      `Perubahan tersimpan pada pengingat: ${item.title || 'Agenda Kelas'}`,
      'reminder'
    );

    syncToCustomApi(`/reminders/${id}`, 'PUT', item);

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await updateDoc(doc(db, 'reminders', id), item);
      } catch (err) {
        console.warn('Reminder update failed:', err);
      }
    }
  };

  const deleteReminder = async (id: string) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    syncToCustomApi(`/reminders/${id}`, 'DELETE');

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await deleteDoc(doc(db, 'reminders', id));
      } catch (err) {
        console.warn('Reminder delete error:', err);
      }
    }
  };

  const syncWithCloud = async () => {
    setLoading(true);
    // Push any offline state to Firestore
    try {
      if (isOnline) {
        for (const s of schedules) {
          await setDoc(doc(db, 'schedules', s.id), s);
        }
        for (const a of announcements) {
          await setDoc(doc(db, 'announcements', a.id), a);
        }
        for (const r of reminders) {
          await setDoc(doc(db, 'reminders', r.id), r);
        }
      }
    } catch (err) {
      console.warn('Cloud sync finished with warning:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateDbConfig = (cfg: CustomDatabaseConfig) => {
    setDbConfig(cfg);
    dataService.saveConfig(cfg);
  };

  const syncToCustomApi = async (path: string, method: string, body?: unknown) => {
    if (dbConfig.provider !== 'custom_api' || !dbConfig.apiBaseUrl) return;
    try {
      const cleanBase = dataService.normalizeUrl(dbConfig.apiBaseUrl);
      if (!cleanBase) return;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const url = `${cleanBase}${cleanPath}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      const authHeader = await dataService.getAuthHeaderValue(dbConfig);
      if (authHeader) {
        headers[dbConfig.authHeaderName || 'Authorization'] = authHeader;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e) {
      console.warn(`Custom API sync notice for ${path} (Firebase Auth remains completely unaffected):`, e);
    }
  };

  const describeRosterError = (err: unknown) => {
    if (err instanceof RoleApiError) {
      if (err.kind === 'forbidden') return 'Anda tidak memiliki izin untuk mengubah data anggota.';
      if (err.kind === 'conflict') return err.message || 'Email tersebut sudah terdaftar.';
      return err.message;
    }
    return 'Terjadi kesalahan saat menghubungi server.';
  };

  const updateMemberRole = async (memberId: string, newRole: UserRole): Promise<boolean> => {
    const target = classMembers.find(m => m.id === memberId);
    if (!target || target.role === newRole) return true;

    // Optimistic update
    const previous = classMembers;
    const next = classMembers.map(m => (m.id === memberId ? { ...m, role: newRole } : m));
    setClassMembers(next);
    offlineStorage.saveClassMembers(next);
    syncToCustomApi(`/users/${encodeURIComponent(memberId)}`, 'PATCH', { role: newRole });

    // If external role API is not configured via env, local update + custom api sync is immediately authoritative
    if (!isRoleApiConfigured) {
      notificationService.dispatchNotification(
        'Role Anggota Diperbarui',
        `${target.name} sekarang ${ROLE_DEFINITIONS[newRole]?.label || newRole}.`,
        'normal'
      );
      if (user && target.email.toLowerCase() === user.email.toLowerCase()) {
        await refreshAccess();
      }
      return true;
    }

    try {
      const saved = await roleApi.updateUserRole(memberId, newRole);
      setClassMembers(curr => {
        const nextList = curr.map(m => (m.id === memberId ? (saved ? toStudentMember(saved) : { ...m, role: newRole }) : m));
        offlineStorage.saveClassMembers(nextList);
        return nextList;
      });
      notificationService.dispatchNotification(
        'Role Anggota Diperbarui',
        `${target.name} sekarang ${ROLE_DEFINITIONS[newRole]?.label || newRole}.`,
        'normal'
      );
      if (user && target.email.toLowerCase() === user.email.toLowerCase()) await refreshAccess();
      return true;
    } catch (err) {
      setClassMembers(previous);
      offlineStorage.saveClassMembers(previous);
      notificationService.dispatchNotification('Gagal Mengubah Role', describeRosterError(err), 'urgent');
      return false;
    }
  };

  const addMember = async (memberData: Omit<StudentMember, 'id'>): Promise<boolean> => {
    // If external role API is not configured, create locally and sync to custom API
    if (!isRoleApiConfigured) {
      const newMember: StudentMember = {
        ...memberData,
        id: `mhs-${Date.now()}`,
        avatarUrl: memberData.avatarUrl || (
          memberData.role === 'super_admin'
            ? ASSET_IMAGES.superAdminAvatar
            : memberData.role === 'class_admin'
            ? ASSET_IMAGES.classAdminAvatar
            : ASSET_IMAGES.classMemberAvatar
        ),
        attendanceRate: memberData.attendanceRate ?? 100,
        lastActive: 'Baru saja',
      };
      const next = [...classMembers, newMember];
      setClassMembers(next);
      offlineStorage.saveClassMembers(next);
      syncToCustomApi('/users', 'POST', newMember);

      // Directly sync to Firestore so subsequent SSO logins recognize this whitelisted student
      if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
        setDoc(doc(db, 'users', newMember.id), {
          email: newMember.email.trim().toLowerCase(),
          displayName: newMember.name,
          role: newMember.role,
          nim: newMember.nim,
          status: 'active',
          createdAt: new Date().toISOString(),
        }, { merge: true }).catch(e => console.warn('Firestore addMember notice:', e));
      }

      notificationService.dispatchNotification(
        'Anggota Baru Terdaftar',
        `${newMember.name} (${newMember.email}) terdaftar & siap login via SSO.`,
        'normal'
      );
      return true;
    }

    try {
      const created = toStudentMember(
        await roleApi.createUser({
          email: memberData.email.trim().toLowerCase(),
          name: memberData.name.trim(),
          nim: memberData.nim?.trim() || undefined,
          role: memberData.role,
        })
      );
      setClassMembers(curr => {
        const next = [...curr.filter(m => m.id !== created.id), created];
        offlineStorage.saveClassMembers(next);
        return next;
      });
      notificationService.dispatchNotification(
        'Anggota Baru Terdaftar',
        `${created.name} (${created.email}) terdaftar & siap login via SSO.`,
        'normal'
      );
      return true;
    } catch (err) {
      notificationService.dispatchNotification('Gagal Menambah Anggota', describeRosterError(err), 'urgent');
      return false;
    }
  };

  const approvePendingUser = async (id: string, newRole: UserRole, nim: string): Promise<boolean> => {
    const approvedMember = offlineStorage.approveUserAccess(
      id,
      newRole,
      nim,
      user?.displayName || 'Super Admin'
    );
    if (!approvedMember) return false;

    // Update roster state locally
    setClassMembers(prev => [...prev.filter(m => m.email.toLowerCase() !== approvedMember.email.toLowerCase()), approvedMember]);
    setPendingApprovals(offlineStorage.getPendingApprovals());

    notificationService.dispatchNotification(
      'Akses User Disetujui',
      `${approvedMember.name} (${approvedMember.email}) disetujui sebagai ${ROLE_DEFINITIONS[newRole]?.label || newRole}.`,
      'normal'
    );

    // Sync to PostgreSQL backend via roleApi so /me returns active role for this user
    if (isRoleApiConfigured) {
      try {
        await roleApi.createUser({
          email: approvedMember.email.trim().toLowerCase(),
          name: approvedMember.name.trim(),
          nim: approvedMember.nim.trim(),
          role: newRole,
        });
      } catch (err) {
        console.warn('Campus API createUser notice (might already exist in PostgreSQL):', err);
      }
    }
    syncToCustomApi('/users', 'POST', approvedMember);

    // Sync to Firestore users collection & remove from pending_approvals
    if (isOnline) {
      deleteDoc(doc(db, 'pending_approvals', id)).catch(() => undefined);
      setDoc(doc(db, 'users', approvedMember.id), {
        email: approvedMember.email.toLowerCase(),
        displayName: approvedMember.name,
        role: approvedMember.role,
        nim: approvedMember.nim,
        status: 'active',
        approvedAt: new Date().toISOString(),
      }, { merge: true }).catch(e => console.warn('Firestore approval notice:', e));
    }

    // Refresh if the approved user is current user
    if (user && user.email.toLowerCase() === approvedMember.email.toLowerCase()) {
      await refreshAccess();
    }

    return true;
  };

  const rejectPendingUser = async (id: string): Promise<boolean> => {
    offlineStorage.rejectUserAccess(id, user?.displayName || 'Super Admin');
    setPendingApprovals(offlineStorage.getPendingApprovals());
    if (isOnline) {
      deleteDoc(doc(db, 'pending_approvals', id)).catch(() => undefined);
    }
    notificationService.dispatchNotification('Akses Ditolak', 'Permintaan akses user SSO telah ditolak.', 'normal');
    return true;
  };

  const deleteMember = async (memberId: string): Promise<boolean> => {
    syncToCustomApi(`/users/${encodeURIComponent(memberId)}`, 'DELETE');
    if (!isRoleApiConfigured) {
      const next = classMembers.filter(m => m.id !== memberId);
      setClassMembers(next);
      offlineStorage.saveClassMembers(next);
      return true;
    }

    try {
      await roleApi.deleteUser(memberId);
      setClassMembers(curr => {
        const next = curr.filter(m => m.id !== memberId);
        offlineStorage.saveClassMembers(next);
        return next;
      });
      return true;
    } catch (err) {
      notificationService.dispatchNotification('Gagal Menghapus Anggota', describeRosterError(err), 'urgent');
      return false;
    }
  };

  return (
    <ClassDataContext.Provider
      value={{
        schedules,
        announcements,
        reminders,
        readReceipts,
        classMembers,
        pendingApprovals,
        approvePendingUser,
        rejectPendingUser,
        loading,
        dbConfig,
        updateDbConfig,
        membersError,
        reloadMembers,
        updateMemberRole,
        addMember,
        deleteMember,
        addAnnouncement,
        deleteAnnouncement,
        markAnnouncementAsRead,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        addReminder,
        updateReminder,
        toggleReminderComplete,
        deleteReminder,
        syncWithCloud,
      }}
    >
      {children}
    </ClassDataContext.Provider>
  );
};

export const useClassData = () => {
  const context = useContext(ClassDataContext);
  if (!context) {
    throw new Error('useClassData must be used within a ClassDataProvider');
  }
  return context;
};
