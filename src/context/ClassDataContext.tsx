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
} from '../lib/dataService';
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
  // The API and Firestore reject calls without a session, so wait for a signed-in, approved user.
  const canLoadData = Boolean(authUid && user?.status === 'active');
  // Report a failed data load once per account instead of on every re-run of the loader.
  const loadFailureReportedFor = useRef<string | null>(null);

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

    // If provider is custom_api, fetch records from the personal backend API
    if (dbConfig.provider === 'custom_api' && dbConfig.apiBaseUrl) {
      (async () => {
        try {
          const [customScheds, customAnns, customRems] = await Promise.all([
            dataService.fetchFromCustomApi<ScheduleItem[]>('/schedules', dbConfig),
            dataService.fetchFromCustomApi<Announcement[]>('/announcements', dbConfig),
            dataService.fetchFromCustomApi<ReminderItem[]>('/reminders', dbConfig),
          ]);
          if (cancelled) return;

          // fetchFromCustomApi answers null when the request failed; old data stays on screen.
          if ((!customScheds || !customAnns || !customRems) && loadFailureReportedFor.current !== authUid) {
            loadFailureReportedFor.current = authUid;
            notificationService.dispatchNotification(
              'Gagal Memuat Data dari Server',
              'Sebagian jadwal, berita, atau pengingat tidak bisa dimuat. Yang tampil adalah data terakhir di perangkat ini.',
              'important'
            );
          }
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
        } catch (e) {
          console.warn('Personal API data load notice:', e);
        }
      })();
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
      cancelled = true;
      schedUnsub();
      annUnsub();
      remUnsub();
      approvalsUnsub();
    };
  }, [authUid, canLoadData, isOnline, isAdminUser, dbConfig.provider, dbConfig.apiBaseUrl, dbConfig.syncWithFirestoreBackup]);

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

    const updated = [saved, ...announcements];
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

    const updated = announcements.filter(a => a.id !== id);
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
    const updatedAnnouncements = announcements.map(a =>
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

    const updated = [...schedules, saved];
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

    const updated = schedules.map(s => (s.id === id ? merged : s));
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

    const updated = schedules.filter(s => s.id !== id);
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

    const updated = [saved, ...reminders];
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
    const updated = reminders.map(r => (r.id === id ? { ...r, isCompleted: !r.isCompleted } : r));
    setReminders(updated);
    offlineStorage.saveReminders(updated);

    const item = updated.find(r => r.id === id);
    if (item) {
      syncToCustomApi(`/reminders/${encodeURIComponent(id)}`, 'PUT', toApiReminder(item), { silent: true });
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

    const updated = reminders.map(r => (r.id === id ? merged : r));
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

    const updated = reminders.filter(r => r.id !== id);
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

  const approvePendingUser = async (id: string, newRole: UserRole, nim: string): Promise<boolean> => {
    const target = offlineStorage.getPendingApprovals().find(p => p.id === id);
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

    const approvedMember = offlineStorage.approveUserAccess(id, newRole, nim, user?.displayName || 'Super Admin');
    if (!approvedMember) return false;

    setPendingApprovals(offlineStorage.getPendingApprovals());
    await reloadMembers();

    notificationService.dispatchNotification(
      'Akses User Disetujui',
      alreadyRegistered
        ? `${approvedMember.email} sudah terdaftar di database, sehingga role-nya mengikuti data yang ada.`
        : `${approvedMember.name} (${approvedMember.email}) disetujui sebagai ${ROLE_DEFINITIONS[newRole]?.label || newRole}.`,
      'normal'
    );

    // Remove from the pending_approvals queue
    if (isOnline) {
      deleteDoc(doc(db, 'pending_approvals', id)).catch(() => undefined);
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
