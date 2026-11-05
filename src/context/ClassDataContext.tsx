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
import { ScheduleItem, Announcement, ReminderItem, ReadReceipt, StudentMember, UserRole, ROLE_DEFINITIONS } from '../types';
import { offlineStorage } from '../lib/offlineStorage';
import { notificationService } from '../lib/notifications';
import { useAuth } from './AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { dataService, CustomDatabaseConfig } from '../lib/dataService';
import { roleApi, toStudentMember, RoleApiError } from '../lib/roleApi';

interface ClassDataContextType {
  schedules: ScheduleItem[];
  announcements: Announcement[];
  reminders: ReminderItem[];
  readReceipts: ReadReceipt[];
  classMembers: StudentMember[];
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
  // The roster lives in the role-management database behind the role API; localStorage is
  // only an offline copy of the last successful load.
  const [classMembers, setClassMembers] = useState<StudentMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isAdminUser = user?.role === 'super_admin' || user?.role === 'class_admin';

  const reloadMembers = useCallback(async () => {
    if (!isAdminUser) {
      setClassMembers([]);
      setMembersError(null);
      return;
    }
    if (!isOnline) {
      setClassMembers(offlineStorage.getClassMembers());
      return;
    }
    try {
      const members = (await roleApi.listUsers()).map(toStudentMember);
      setClassMembers(members);
      setMembersError(null);
      offlineStorage.saveClassMembers(members);
    } catch (err) {
      console.warn('Role API roster load failed:', err);
      setMembersError(err instanceof Error ? err.message : 'Gagal memuat daftar anggota.');
      setClassMembers(offlineStorage.getClassMembers());
    }
  }, [isAdminUser, isOnline]);

  // Members only see their own data; admins load the roster for the signed-in account.
  useEffect(() => {
    reloadMembers();
  }, [reloadMembers, user?.id]);

  // Firestore listeners when online
  useEffect(() => {
    if (!isOnline) {
      // Load offline cached data
      setSchedules(offlineStorage.getSchedules());
      setAnnouncements(offlineStorage.getAnnouncements());
      setReminders(offlineStorage.getReminders());
      setReadReceipts(offlineStorage.getReadReceipts());
      return;
    }

    // If provider is custom_api, attempt to fetch latest records from the personal backend
    if (dbConfig.provider === 'custom_api' && dbConfig.apiBaseUrl) {
      (async () => {
        try {
          const [customScheds, customAnns, customRems] = await Promise.all([
            dataService.fetchFromCustomApi<ScheduleItem[]>('/schedules', dbConfig),
            dataService.fetchFromCustomApi<Announcement[]>('/announcements', dbConfig),
            dataService.fetchFromCustomApi<ReminderItem[]>('/reminders', dbConfig),
          ]);
          if (customScheds && Array.isArray(customScheds) && customScheds.length > 0) {
            setSchedules(customScheds);
            offlineStorage.saveSchedules(customScheds);
          }
          if (customAnns && Array.isArray(customAnns) && customAnns.length > 0) {
            setAnnouncements(customAnns);
            offlineStorage.saveAnnouncements(customAnns);
          }
          if (customRems && Array.isArray(customRems) && customRems.length > 0) {
            setReminders(customRems);
            offlineStorage.saveReminders(customRems);
          }
        } catch (e) {
          console.warn('Personal API data load error, gracefully falling back to local/cloud cache:', e);
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

    return () => {
      schedUnsub();
      annUnsub();
      remUnsub();
    };
  }, [authUid, isOnline, dbConfig.provider, dbConfig.apiBaseUrl, dbConfig.syncWithFirestoreBackup]);

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
      const url = `${dbConfig.apiBaseUrl.replace(/\/$/, '')}${path}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      const authHeader = await dataService.getAuthHeaderValue(dbConfig);
      if (authHeader) {
        headers[dbConfig.authHeaderName || 'Authorization'] = authHeader;
      }
      await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      console.warn(`Custom API sync failed for ${path} (Firebase Auth remains completely unaffected):`, e);
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

    // Optimistic update, rolled back if the API refuses.
    const previous = classMembers;
    setClassMembers(classMembers.map(m => (m.id === memberId ? { ...m, role: newRole } : m)));
    try {
      const saved = await roleApi.updateUserRole(memberId, newRole);
      setClassMembers(curr => {
        const next = curr.map(m => (m.id === memberId ? (saved ? toStudentMember(saved) : { ...m, role: newRole }) : m));
        offlineStorage.saveClassMembers(next);
        return next;
      });
      notificationService.dispatchNotification(
        'Role Anggota Diperbarui',
        `${target.name} sekarang ${ROLE_DEFINITIONS[newRole]?.label || newRole}.`,
        'normal'
      );
      // Changing one's own role takes effect immediately.
      if (user && target.email.toLowerCase() === user.email.toLowerCase()) await refreshAccess();
      return true;
    } catch (err) {
      setClassMembers(previous);
      notificationService.dispatchNotification('Gagal Mengubah Role', describeRosterError(err), 'urgent');
      return false;
    }
  };

  const addMember = async (memberData: Omit<StudentMember, 'id'>): Promise<boolean> => {
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
        `${created.name} ditambahkan sebagai ${ROLE_DEFINITIONS[created.role]?.label || created.role}.`,
        'normal'
      );
      return true;
    } catch (err) {
      notificationService.dispatchNotification('Gagal Menambah Anggota', describeRosterError(err), 'urgent');
      return false;
    }
  };

  const deleteMember = async (memberId: string): Promise<boolean> => {
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
