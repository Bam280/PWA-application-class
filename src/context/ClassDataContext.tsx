import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
import {
  dataService,
  CustomDatabaseConfig,
  extractApiErrorDetail,
  normalizeAnnouncement,
  normalizeReminder,
  normalizeSchedule,
  toApiAnnouncement,
  toApiReminder,
  toApiSchedule,
  sameApiRows,
  describeScheduleChanges,
} from '../lib/dataService';
import { roleApi, toStudentMember, RoleApiError, isRoleApiConfigured } from '../lib/roleApi';
import { ASSET_IMAGES } from '../lib/seedData';
import { ACCESS_REQUESTS_COLLECTION, ACCESS_REQUEST_RETRY_MS, firestoreErrorCode, toPendingApprovals } from '../lib/accessRequests';

interface ClassDataContextType {
  schedules: ScheduleItem[];
  announcements: Announcement[];
  reminders: ReminderItem[];
  readReceipts: ReadReceipt[];
  classMembers: StudentMember[];
  pendingApprovals: PendingUserApproval[];
  /** Why the queue could not be read; the list is not trustworthy while this is set. */
  approvalsError: string | null;
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
  addAnnouncement: (item: Omit<Announcement, 'id' | 'publishedAt' | 'readCount'>) => Promise<boolean>;
  deleteAnnouncement: (id: string) => Promise<boolean>;
  markAnnouncementAsRead: (announcementId: string) => Promise<void>;
  addSchedule: (item: Omit<ScheduleItem, 'id'>) => Promise<boolean>;
  updateSchedule: (id: string, item: Partial<ScheduleItem>) => Promise<boolean>;
  deleteSchedule: (id: string) => Promise<boolean>;
  addReminder: (item: Omit<ReminderItem, 'id' | 'createdAt'>) => Promise<boolean>;
  updateReminder: (id: string, item: Partial<ReminderItem>) => Promise<boolean>;
  toggleReminderComplete: (id: string) => void;
  deleteReminder: (id: string) => Promise<boolean>;
  syncWithCloud: () => Promise<void>;
}

const ClassDataContext = createContext<ClassDataContextType | undefined>(undefined);

// The API has no push channel, so open tabs ask for new data on a timer.
const AUTO_REFRESH_MS = 30_000;
// Returning to the tab refreshes right away, unless a refresh just happened.
const RETURN_REFRESH_MIN_GAP_MS = 5_000;

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
  const [pendingApprovals, setPendingApprovals] = useState<PendingUserApproval[]>([]);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isAdminUser = user?.role === 'super_admin' || user?.role === 'class_admin';
  // The API and Firestore reject calls without a session, so wait for a signed-in, approved user.
  const canLoadData = Boolean(authUid && user?.status === 'active');
  // Report a failed data load once per account instead of on every re-run of the loader.
  const loadFailureReportedFor = useRef<string | null>(null);
  // Newest lists, for code that runs after an await and would otherwise see the lists from before it.
  const latest = useRef({ schedules, announcements, reminders });
  latest.current = { schedules, announcements, reminders };
  // Counts finished saves. A refresh that overlaps a save may hold a list from before it, so it is dropped.
  const saveVersion = useRef(0);
  // Ids already seen per list, to tell which rows in a refresh are new. null = nothing loaded yet.
  const seenIds = useRef<{
    uid: string | null;
    schedules: Set<string> | null;
    announcements: Set<string> | null;
    reminders: Set<string> | null;
  } | null>(null);
  // Reminder ticks the server has not confirmed (a member may not be allowed to update reminders).
  // Without this, each refresh would undo the tick.
  const completionOverrides = useRef(new Map<string, boolean>());

  const reloadMembers = useCallback(async () => {
    if (!isAdminUser) {
      setClassMembers([]);
      setMembersError(null);
      return;
    }
    if (isOnline && isRoleApiConfigured) {
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
      return;
    }
    // Role API not usable (misconfigured build) or offline: last known roster, or the private API.
    const customMembers =
      isOnline && !isRoleApiConfigured
        ? await dataService.fetchFromCustomApi<StudentMember[]>('/users', dbConfig)
        : null;
    setClassMembers(customMembers && Array.isArray(customMembers) ? customMembers : offlineStorage.getClassMembers());
    setMembersError(null);
  }, [isAdminUser, isOnline, dbConfig]);

  // Members only see their own data; admins load the roster for the signed-in account.
  useEffect(() => {
    reloadMembers();
  }, [reloadMembers, user?.id]);

  // Access requests waiting for approval, live from Firestore. A refused read is retried, so the
  // list recovers by itself once the rules are published.
  useEffect(() => {
    setPendingApprovals([]);
    setApprovalsError(null);
    if (!canLoadData || !isAdminUser) return;
    if (!isOnline) {
      setApprovalsError('Antrean permintaan akses tidak bisa dimuat saat offline.');
      return;
    }
    let unsubscribe = () => {};
    let retryTimer: number | undefined;
    const listen = () => {
      unsubscribe = onSnapshot(
        collection(db, ACCESS_REQUESTS_COLLECTION),
        (snapshot) => {
          setPendingApprovals(toPendingApprovals(snapshot.docs.map(d => ({ id: d.id, data: d.data() }))));
          setApprovalsError(null);
        },
        (err) => {
          console.warn('Pending approvals listener notice:', err.message);
          setPendingApprovals([]);
          setApprovalsError(
            `Antrean permintaan akses tidak bisa dibaca, jadi permintaan yang masuk belum terlihat. Pastikan isi firestore.rules sudah di-publish di Firebase Console. Aplikasi mencoba lagi otomatis. (Kode: ${firestoreErrorCode(err)})`
          );
          retryTimer = window.setTimeout(listen, ACCESS_REQUEST_RETRY_MS);
        }
      );
    };
    listen();
    return () => {
      unsubscribe();
      window.clearTimeout(retryTimer);
    };
  }, [authUid, canLoadData, isAdminUser, isOnline]);

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

    // No session yet (or still waiting for approval): keep the local cache, every call would be rejected.
    if (!canLoadData) return;
    let cancelled = false;
    let stopAutoRefresh = () => {};

    // If provider is custom_api, fetch records from the personal backend API
    if (dbConfig.provider === 'custom_api' && dbConfig.apiBaseUrl) {
      let loading = false;
      let lastLoadAt = 0;

      const load = async () => {
        if (loading) return;
        loading = true;
        lastLoadAt = Date.now();
        const versionAtStart = saveVersion.current;
        try {
          const [customScheds, customAnns, customRems] = await Promise.all([
            dataService.fetchFromCustomApi<ScheduleItem[]>('/schedules', dbConfig),
            dataService.fetchFromCustomApi<Announcement[]>('/announcements', dbConfig),
            dataService.fetchFromCustomApi<ReminderItem[]>('/reminders', dbConfig),
          ]);
          if (cancelled || saveVersion.current !== versionAtStart) return;

          // fetchFromCustomApi answers null when the request failed; old data stays on screen.
          if (!customScheds || !customAnns || !customRems) {
            if (loadFailureReportedFor.current !== authUid) {
              loadFailureReportedFor.current = authUid;
              notificationService.dispatchNotification(
                'Gagal Memuat Data dari Server',
                'Sebagian jadwal, berita, atau pengingat tidak bisa dimuat. Yang tampil adalah data terakhir di perangkat ini.',
                'important'
              );
            }
          } else {
            loadFailureReportedFor.current = null;
          }

          if (seenIds.current?.uid !== authUid) {
            seenIds.current = { uid: authUid, schedules: null, announcements: null, reminders: null };
            completionOverrides.current.clear();
          }
          const seen = seenIds.current;
          const hadScheduleBaseline = seen.schedules !== null;

          // The first list loaded is only a baseline, so opening the app does not announce every old row.
          const takeNew = <T extends { id: string }>(
            list: T[] | null,
            key: 'schedules' | 'announcements' | 'reminders'
          ): T[] => {
            if (!list || !Array.isArray(list)) return [];
            const before = seen[key];
            seen[key] = new Set(list.map(item => item.id));
            return before ? list.filter(item => !before.has(item.id)) : [];
          };
          const newAnns = takeNew(customAnns, 'announcements');
          const newScheds = takeNew(customScheds, 'schedules');
          const newRems = takeNew(customRems, 'reminders');

          if (newAnns.length === 1) {
            notificationService.dispatchNotification(
              `Pengumuman Baru: ${newAnns[0].title}`,
              newAnns[0].content.slice(0, 90),
              newAnns[0].priority,
              { alertDevice: true }
            );
          } else if (newAnns.length > 1) {
            notificationService.dispatchNotification(`${newAnns.length} Pengumuman Baru`, 'Buka menu Berita untuk membacanya.', 'normal', { alertDevice: true });
          }
          if (newScheds.length === 1) {
            notificationService.dispatchNotification('Jadwal Baru', newScheds[0].courseName, 'normal', { alertDevice: true });
          } else if (newScheds.length > 1) {
            notificationService.dispatchNotification(`${newScheds.length} Jadwal Baru`, 'Buka menu Jadwal untuk melihatnya.', 'normal', { alertDevice: true });
          }
          if (newRems.length === 1) {
            notificationService.dispatchNotification(
              `Pengingat Baru: ${newRems[0].title}`,
              `Batas Waktu: ${new Date(newRems[0].deadline).toLocaleDateString('id-ID')}`,
              'reminder',
              { alertDevice: true }
            );
          } else if (newRems.length > 1) {
            notificationService.dispatchNotification(`${newRems.length} Pengingat Baru`, 'Buka menu Pengingat untuk melihatnya.', 'reminder', { alertDevice: true });
          }

          // Edits and removals by someone else. A user's own saves already updated the list on screen.
          if (hadScheduleBaseline && customScheds && Array.isArray(customScheds)) {
            const { changed, removed } = describeScheduleChanges(latest.current.schedules, customScheds);
            for (const { item, details } of changed) {
              notificationService.dispatchNotification(`Jadwal Berubah: ${item.courseName}`, details, 'important', { alertDevice: true });
            }
            for (const item of removed) {
              notificationService.dispatchNotification(`Jadwal Dibatalkan: ${item.courseName}`, 'Jadwal ini sudah dihapus oleh admin.', 'important', { alertDevice: true });
            }
          }

          // Only touch state when something changed, so an idle refresh does not re-render the app.
          if (customScheds && Array.isArray(customScheds) && !sameApiRows(customScheds, latest.current.schedules)) {
            setSchedules(customScheds);
            offlineStorage.saveSchedules(customScheds);
          }
          if (customAnns && Array.isArray(customAnns) && !sameApiRows(customAnns, latest.current.announcements)) {
            setAnnouncements(customAnns);
            offlineStorage.saveAnnouncements(customAnns);
          }
          if (customRems && Array.isArray(customRems)) {
            const withTicks = customRems.map(r =>
              completionOverrides.current.has(r.id) ? { ...r, isCompleted: completionOverrides.current.get(r.id) } : r
            );
            if (!sameApiRows(withTicks, latest.current.reminders)) {
              setReminders(withTicks);
              offlineStorage.saveReminders(withTicks);
            }
          }
        } catch (e) {
          console.warn('Personal API data load notice:', e);
        } finally {
          loading = false;
        }
      };

      load();

      // Background tabs only poll when device notifications are on; otherwise they catch up on return.
      const timer = window.setInterval(() => {
        if (!document.hidden || notificationService.getDeviceState() === 'granted') load();
      }, AUTO_REFRESH_MS);
      const onReturn = () => {
        if (!document.hidden && Date.now() - lastLoadAt > RETURN_REFRESH_MIN_GAP_MS) load();
      };
      document.addEventListener('visibilitychange', onReturn);
      window.addEventListener('focus', onReturn);
      stopAutoRefresh = () => {
        window.clearInterval(timer);
        document.removeEventListener('visibilitychange', onReturn);
        window.removeEventListener('focus', onReturn);
      };
    }

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
      cancelled = true;
      stopAutoRefresh();
      schedUnsub();
      annUnsub();
      remUnsub();
    };
  }, [authUid, canLoadData, isOnline, dbConfig.provider, dbConfig.apiBaseUrl, dbConfig.syncWithFirestoreBackup]);

  /** Save through the private API first, so the screen only ever shows what the server accepted. */
  const usesCustomApi = dbConfig.provider === 'custom_api' && Boolean(dbConfig.apiBaseUrl);

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

    let saved = newAnnouncement;
    if (usesCustomApi) {
      const result = await syncToCustomApi('/announcements', 'POST', toApiAnnouncement(newAnnouncement));
      if (!result.ok) return false;
      if (result.data) saved = normalizeAnnouncement(result.data);
    }
    seenIds.current?.announcements?.add(saved.id);

    const updated = [saved, ...latest.current.announcements];
    setAnnouncements(updated);
    offlineStorage.saveAnnouncements(updated);

    // Dispatch real-time push notification & sound chime
    notificationService.dispatchNotification(
      saved.title,
      saved.content.slice(0, 90) + '...',
      newAnnouncement.priority
    );

    // Sync to Firestore if online
    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await setDoc(doc(db, 'announcements', saved.id), saved);
      } catch (err) {
        console.warn('Saved locally, Firestore sync pending:', err);
      }
    }
    return true;
  };

  const deleteAnnouncement = async (id: string) => {
    if (usesCustomApi && !(await syncToCustomApi(`/announcements/${encodeURIComponent(id)}`, 'DELETE')).ok) return false;

    const updated = latest.current.announcements.filter(a => a.id !== id);
    setAnnouncements(updated);
    offlineStorage.saveAnnouncements(updated);

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await deleteDoc(doc(db, 'announcements', id));
      } catch (err) {
        console.warn('Firestore delete error:', err);
      }
    }
    return true;
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
    const updatedAnnouncements = latest.current.announcements.map(a =>
      a.id === announcementId ? { ...a, readCount: (a.readCount || 0) + 1 } : a
    );
    setAnnouncements(updatedAnnouncements);
    offlineStorage.saveAnnouncements(updatedAnnouncements);

    syncToCustomApi(`/announcements/${announcementId}/reads`, 'POST', receipt, { silent: true });

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

    let saved = newSchedule;
    if (usesCustomApi) {
      const result = await syncToCustomApi('/schedules', 'POST', toApiSchedule(newSchedule));
      if (!result.ok) return false;
      if (result.data) saved = normalizeSchedule(result.data);
    }
    seenIds.current?.schedules?.add(saved.id);

    const updated = [...latest.current.schedules, saved];
    setSchedules(updated);
    offlineStorage.saveSchedules(updated);

    notificationService.dispatchNotification(
      'Jadwal Kuliah Diperbarui',
      `Jadwal baru ditambahkan: ${saved.courseName}${saved.room ? ` (${saved.room})` : ''}`,
      'normal'
    );

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await setDoc(doc(db, 'schedules', saved.id), saved);
      } catch (err) {
        console.warn('Schedule sync failed:', err);
      }
    }
    return true;
  };

  const updateSchedule = async (id: string, item: Partial<ScheduleItem>) => {
    const existing = schedules.find(s => s.id === id);
    if (!existing) return false;
    let merged: ScheduleItem = { ...existing, ...item, updatedAt: new Date().toISOString() };
    if (usesCustomApi) {
      const result = await syncToCustomApi(`/schedules/${encodeURIComponent(id)}`, 'PUT', toApiSchedule(merged));
      if (!result.ok) return false;
      if (result.data) merged = normalizeSchedule(result.data);
    }

    const updated = latest.current.schedules.map(s => (s.id === id ? merged : s));
    setSchedules(updated);
    offlineStorage.saveSchedules(updated);

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await updateDoc(doc(db, 'schedules', id), item);
      } catch (err) {
        console.warn('Schedule update failed:', err);
      }
    }
    return true;
  };

  const deleteSchedule = async (id: string) => {
    if (usesCustomApi && !(await syncToCustomApi(`/schedules/${encodeURIComponent(id)}`, 'DELETE')).ok) return false;

    const updated = latest.current.schedules.filter(s => s.id !== id);
    setSchedules(updated);
    offlineStorage.saveSchedules(updated);

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
      } catch (err) {
        console.warn('Schedule delete failed:', err);
      }
    }
    return true;
  };

  const addReminder = async (item: Omit<ReminderItem, 'id' | 'createdAt'>) => {
    const newId = `rem-${Date.now()}`;
    const newReminder: ReminderItem = {
      ...item,
      id: newId,
      createdAt: new Date().toISOString(),
      isCompleted: false,
    };

    let saved = newReminder;
    if (usesCustomApi) {
      const result = await syncToCustomApi('/reminders', 'POST', toApiReminder(newReminder));
      if (!result.ok) return false;
      if (result.data) saved = normalizeReminder(result.data);
    }
    seenIds.current?.reminders?.add(saved.id);

    const updated = [saved, ...latest.current.reminders];
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    notificationService.dispatchNotification(
      `Pengingat Ditambahkan: ${saved.title}`,
      `Batas Waktu: ${new Date(saved.deadline).toLocaleDateString('id-ID')}`,
      'reminder'
    );

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await setDoc(doc(db, 'reminders', saved.id), saved);
      } catch (err) {
        console.warn('Reminder sync failed:', err);
      }
    }
    return true;
  };

  const toggleReminderComplete = (id: string) => {
    const updated = latest.current.reminders.map(r => (r.id === id ? { ...r, isCompleted: !r.isCompleted } : r));
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    const item = updated.find(r => r.id === id);
    if (item) {
      completionOverrides.current.set(id, Boolean(item.isCompleted));
      syncToCustomApi(`/reminders/${encodeURIComponent(id)}`, 'PUT', toApiReminder(item), { silent: true }).then(result => {
        if (result.ok) completionOverrides.current.delete(id);
      });
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
    const existing = reminders.find(r => r.id === id);
    if (!existing) return false;
    let merged: ReminderItem = { ...existing, ...item };
    if (usesCustomApi) {
      const result = await syncToCustomApi(`/reminders/${encodeURIComponent(id)}`, 'PUT', toApiReminder(merged));
      if (!result.ok) return false;
      if (result.data) merged = normalizeReminder(result.data);
    }

    const updated = latest.current.reminders.map(r => (r.id === id ? merged : r));
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    notificationService.dispatchNotification(
      'Pengingat Diperbarui',
      `Perubahan tersimpan pada pengingat: ${merged.title || 'Agenda Kelas'}`,
      'reminder'
    );

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await updateDoc(doc(db, 'reminders', id), item);
      } catch (err) {
        console.warn('Reminder update failed:', err);
      }
    }
    return true;
  };

  const deleteReminder = async (id: string) => {
    if (usesCustomApi && !(await syncToCustomApi(`/reminders/${encodeURIComponent(id)}`, 'DELETE')).ok) return false;

    const updated = latest.current.reminders.filter(r => r.id !== id);
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    if (isOnline && (dbConfig.provider === 'firestore' || dbConfig.syncWithFirestoreBackup)) {
      try {
        await deleteDoc(doc(db, 'reminders', id));
      } catch (err) {
        console.warn('Reminder delete error:', err);
      }
    }
    return true;
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

  /**
   * Sends a change to the private API. The screen has already been updated, so a failure must be
   * reported: otherwise the change silently disappears on the next reload.
   * `silent` is for background updates the user did not explicitly ask to save.
   * Resolves with the outcome and the row the server answered with (unwrapped from { data }).
   */
  const syncToCustomApi = async (
    path: string,
    method: string,
    body?: unknown,
    options?: { silent?: boolean }
  ): Promise<{ ok: boolean; data?: unknown }> => {
    if (dbConfig.provider !== 'custom_api' || !dbConfig.apiBaseUrl) return { ok: true };
    const cleanBase = dataService.normalizeUrl(dbConfig.apiBaseUrl);
    if (!cleanBase) return { ok: true };
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    const report = (reason: string) => {
      console.warn(`Custom API ${method} ${cleanPath} failed: ${reason}`);
      if (options?.silent) return;
      notificationService.dispatchNotification(
        'Gagal Menyimpan ke Server',
        `${reason}. Perubahan ini belum tersimpan.`,
        'urgent'
      );
    };

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
    try {
      const res = await fetch(`${cleanBase}${cleanPath}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        const responseBody: unknown = await res.json().catch(() => null);
        const detail = extractApiErrorDetail(responseBody);
        // Full exchange for debugging a rejected save. The token is in the headers, so it is not logged.
        console.warn(`Custom API ${method} ${cleanPath} rejected`, { sent: body, received: responseBody });
        report(`Server menolak ${method} ${cleanPath} (HTTP ${res.status}${detail ? `: ${detail}` : ''})`);
        return { ok: false };
      }
      const json: any = await res.json().catch(() => null);
      return { ok: true, data: json && typeof json === 'object' && 'data' in json ? json.data : json };
    } catch {
      report(`Server tidak bisa dihubungi untuk ${method} ${cleanPath}`);
      return { ok: false };
    } finally {
      saveVersion.current++;
      clearTimeout(timeout);
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

    // If external role API is not configured via env, local update + custom api sync is immediately authoritative
    if (!isRoleApiConfigured) {
      syncToCustomApi(`/users/${encodeURIComponent(memberId)}`, 'PATCH', { role: newRole });
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

  /** Removes a request from the queue; the listener then updates the list. Tells the admin if Firestore refused. */
  const closeAccessRequest = async (id: string, failureTitle: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, ACCESS_REQUESTS_COLLECTION, id));
      return true;
    } catch (err) {
      notificationService.dispatchNotification(failureTitle, `Permintaan masih ada di antrean. (Kode: ${firestoreErrorCode(err)})`, 'urgent');
      return false;
    }
  };

  const approvePendingUser = async (id: string, newRole: UserRole, nim: string): Promise<boolean> => {
    const target = pendingApprovals.find(p => p.id === id);
    if (!target) return false;

    // The role database decides access: the request only counts as approved once the API saved it.
    // Otherwise the admin would see "approved" while the user stays stuck on the waiting screen.
    let alreadyRegistered = false;
    try {
      await roleApi.createUser({
        email: target.email.trim().toLowerCase(),
        name: target.displayName.trim(),
        nim: nim.trim() || undefined,
        role: newRole,
      });
    } catch (err) {
      if (err instanceof RoleApiError && err.kind === 'conflict') {
        alreadyRegistered = true;
      } else {
        notificationService.dispatchNotification('Gagal Menyetujui Akses', describeRosterError(err), 'urgent');
        return false;
      }
    }

    await closeAccessRequest(id, 'Akses Disetujui, Antrean Belum Terhapus');
    await reloadMembers();

    notificationService.dispatchNotification(
      'Akses User Disetujui',
      alreadyRegistered
        ? `${target.email} sudah terdaftar di database, sehingga role-nya mengikuti data yang ada.`
        : `${target.displayName} (${target.email}) disetujui sebagai ${ROLE_DEFINITIONS[newRole]?.label || newRole}.`,
      'normal'
    );

    // Refresh if the approved user is current user
    if (user && user.email.toLowerCase() === target.email.toLowerCase()) {
      await refreshAccess();
    }

    return true;
  };

  const rejectPendingUser = async (id: string): Promise<boolean> => {
    if (!isOnline) {
      notificationService.dispatchNotification('Gagal Menolak Akses', 'Anda sedang offline. Coba lagi saat tersambung.', 'urgent');
      return false;
    }
    if (!(await closeAccessRequest(id, 'Gagal Menolak Akses'))) return false;
    notificationService.dispatchNotification('Akses Ditolak', 'Permintaan akses user SSO telah ditolak.', 'normal');
    return true;
  };

  const deleteMember = async (memberId: string): Promise<boolean> => {
    if (!isRoleApiConfigured) {
      syncToCustomApi(`/users/${encodeURIComponent(memberId)}`, 'DELETE');
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
        approvalsError,
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
