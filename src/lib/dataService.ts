import { ScheduleItem, Announcement, ReminderItem, ReadReceipt, StudentMember, UserRole } from '../types';
import { offlineStorage } from './offlineStorage';
import { auth } from './firebase';
import { ASSET_IMAGES } from './seedData';

export type DatabaseProviderType = 'firestore' | 'custom_api' | 'local_offline';

export type AuthHeaderMode = 'firebase_jwt' | 'custom_key' | 'none';

export interface CustomDatabaseConfig {
  provider: DatabaseProviderType;
  apiBaseUrl: string;
  apiKey?: string;
  authHeaderMode?: AuthHeaderMode;
  authHeaderName?: string;
  syncWithFirestoreBackup: boolean;
  lastConnectedAt?: string;
}

const STORAGE_KEY_DB_CONFIG = 'uniclass_custom_db_config';

/**
 * Normalizes user-entered API base URLs:
 * - Trims whitespace and surrounding quotes
 * - Prepends http:// or https:// if omitted
 * - Strips trailing slashes
 */
export function normalizeApiUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return '';

  // If missing protocol prefix
  if (!/^https?:\/\//i.test(cleaned)) {
    // If it points to localhost or private local IP, default to http
    if (
      cleaned.startsWith('localhost') ||
      cleaned.startsWith('127.0.0.1') ||
      cleaned.startsWith('0.0.0.0') ||
      cleaned.startsWith('192.168.') ||
      cleaned.startsWith('10.') ||
      cleaned.startsWith('172.')
    ) {
      cleaned = `http://${cleaned}`;
    } else {
      cleaned = `https://${cleaned}`;
    }
  }

  // Strip trailing slashes
  return cleaned.replace(/\/+$/, '');
}

/**
 * Extracts array payloads from common REST API response envelopes:
 * Supports raw arrays, { data: [...] }, { results: [...] }, { items: [...] },
 * { rows: [...] }, or resource-named keys like { schedules: [...] }.
 */
export function extractArrayPayload<T = unknown>(raw: unknown, keyHints: string[] = []): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];

  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;

    // 1. Check custom hints first
    for (const hint of keyHints) {
      if (Array.isArray(obj[hint])) return obj[hint] as T[];
    }

    // 2. Check standard REST envelope keys
    const commonKeys = ['data', 'items', 'results', 'rows', 'records', 'payload', 'list', 'dataList'];
    for (const k of commonKeys) {
      if (Array.isArray(obj[k])) return obj[k] as T[];
    }

    // 3. If obj has a single property that is an array, take it
    const values = Object.values(obj);
    const arrayVal = values.find(v => Array.isArray(v));
    if (arrayVal) return arrayVal as T[];
  }

  return [];
}

/**
 * Helper to parse Indonesian day name or number into 1..7 (1 = Senin).
 */
export function parseDayOfWeekNumber(val: unknown): number {
  if (typeof val === 'number' && !isNaN(val)) {
    return Math.min(Math.max(Math.round(val), 1), 7);
  }
  const str = String(val || '').toLowerCase().trim();
  const dayMap: Record<string, number> = {
    senin: 1,
    mon: 1,
    monday: 1,
    selasa: 2,
    tue: 2,
    tuesday: 2,
    rabu: 3,
    wed: 3,
    wednesday: 3,
    kamis: 4,
    thu: 4,
    thursday: 4,
    jumat: 5,
    fri: 5,
    friday: 5,
    sabtu: 6,
    sat: 6,
    saturday: 6,
    minggu: 7,
    ahad: 7,
    sun: 7,
    sunday: 7,
  };
  return dayMap[str] || 1;
}

/**
 * Normalizes Schedule items from raw API responses (handles snake_case & missing fields).
 */
export function normalizeSchedule(raw: any, index = 0): ScheduleItem {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `sch-${Date.now()}-${index}`,
      courseName: 'Mata Kuliah',
      courseCode: 'MK-01',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      room: 'Ruang Kelas',
      building: 'Gedung Kuliah',
      classType: 'offline',
      lecturer: 'Dosen Pengampu',
      updatedAt: new Date().toISOString(),
    };
  }

  const courseName = (raw.courseName || raw.course_name || raw.mata_kuliah || raw.title || raw.name || 'Mata Kuliah').toString();
  const courseCode = (raw.courseCode || raw.course_code || raw.kode_mk || raw.code || 'MK-01').toString();
  const dayOfWeek = parseDayOfWeekNumber(raw.dayOfWeek ?? raw.day_of_week ?? raw.hari);
  const startTime = (raw.startTime || raw.start_time || raw.jam_mulai || raw.start || '08:00').toString();
  const endTime = (raw.endTime || raw.end_time || raw.jam_selesai || raw.end || '10:00').toString();
  const room = (raw.room || raw.ruangan || raw.ruang || raw.location || 'Ruang Sinabung Lt. 3').toString();
  const building = (raw.building || raw.gedung || raw.kampus || 'BNI Corporate University').toString();
  const classType = ['offline', 'online', 'hybrid'].includes(raw.classType || raw.class_type)
    ? (raw.classType || raw.class_type)
    : 'offline';
  const lecturer = (raw.lecturer || raw.speaker || raw.dosen || raw.instructor || 'Dosen Pengampu').toString();
  const speakerRole = raw.speakerRole || raw.speaker_role || raw.jabatan || raw.role;
  const divisionName = raw.divisionName || raw.division_name || raw.divisi;
  const notes = raw.notes || raw.catatan;
  const updatedAt = raw.updatedAt || raw.updated_at || new Date().toISOString();
  const id = (raw.id || raw._id || raw.schedule_id || raw.id_jadwal || `sch-${Date.now()}-${index}`).toString();

  return {
    id,
    courseName,
    courseCode,
    dayOfWeek,
    startTime,
    endTime,
    room,
    building,
    classType,
    lecturer,
    speakerRole,
    divisionName,
    notes,
    updatedAt,
  };
}

/**
 * Normalizes Announcement items from raw API responses.
 */
export function normalizeAnnouncement(raw: any, index = 0): Announcement {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `ann-${Date.now()}-${index}`,
      title: 'Pengumuman Kelas',
      content: '',
      publishedAt: new Date().toISOString(),
      authorId: 'admin',
      authorName: 'Admin Kelas',
      category: 'academic',
      priority: 'normal',
      readCount: 0,
      totalStudents: 42,
    };
  }

  const id = (raw.id || raw._id || raw.announcement_id || raw.id_pengumuman || `ann-${Date.now()}-${index}`).toString();
  const title = (raw.title || raw.judul || 'Pengumuman Kelas').toString();
  const content = (raw.content || raw.isi || raw.deskripsi || raw.message || '').toString();
  const publishedAt = raw.publishedAt || raw.published_at || raw.created_at || raw.tanggal || new Date().toISOString();
  const authorId = (raw.authorId || raw.author_id || 'admin').toString();
  const authorName = (raw.authorName || raw.author_name || raw.author || raw.pengirim || 'Admin Kelas').toString();
  const category = ['academic', 'exam', 'event', 'schedule_change'].includes(raw.category || raw.kategori)
    ? (raw.category || raw.kategori)
    : 'academic';
  const priority = ['urgent', 'important', 'normal'].includes(raw.priority || raw.prioritas)
    ? (raw.priority || raw.prioritas)
    : 'normal';
  const readCount = Number(raw.readCount ?? raw.read_count ?? raw.dibaca ?? 0) || 0;
  const totalStudents = Number(raw.totalStudents ?? raw.total_students ?? 42) || 42;

  return {
    id,
    title,
    content,
    publishedAt,
    authorId,
    authorName,
    category,
    priority,
    readCount,
    totalStudents,
  };
}

/**
 * Normalizes Reminder items from raw API responses.
 */
export function normalizeReminder(raw: any, index = 0): ReminderItem {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `rem-${Date.now()}-${index}`,
      title: 'Pengingat Tugas',
      courseName: 'Mata Kuliah',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      description: '',
      priority: 'medium',
      isCompleted: false,
      reminderType: 'assignment',
      createdAt: new Date().toISOString(),
    };
  }

  const id = (raw.id || raw._id || raw.reminder_id || raw.id_pengingat || `rem-${Date.now()}-${index}`).toString();
  const title = (raw.title || raw.judul || raw.name || 'Pengingat Agenda').toString();
  const courseName = (raw.courseName || raw.course_name || raw.mata_kuliah || 'Mata Kuliah').toString();
  const deadline = raw.deadline || raw.batas_waktu || raw.due_date || new Date(Date.now() + 86400000).toISOString();
  const description = (raw.description || raw.deskripsi || raw.notes || '').toString();
  const priority = ['low', 'medium', 'high'].includes(raw.priority || raw.prioritas)
    ? (raw.priority || raw.prioritas)
    : 'medium';
  const isCompleted = Boolean(raw.isCompleted ?? raw.is_completed ?? raw.completed ?? (raw.status === 'done' || raw.status === 'completed'));
  
  // Map various labels to ReminderType ('assignment' | 'quiz' | 'exam' | 'project')
  const rawType = String(raw.reminderType || raw.reminder_type || raw.tipe || '').toLowerCase();
  let reminderType: 'assignment' | 'quiz' | 'exam' | 'project' = 'assignment';
  if (rawType.includes('quiz') || rawType.includes('kuis')) reminderType = 'quiz';
  else if (rawType.includes('exam') || rawType.includes('ujian') || rawType.includes('uts') || rawType.includes('uas')) reminderType = 'exam';
  else if (rawType.includes('project') || rawType.includes('proyek')) reminderType = 'project';

  const createdAt = raw.createdAt || raw.created_at || new Date().toISOString();

  return {
    id,
    title,
    courseName,
    deadline,
    description,
    priority,
    isCompleted,
    reminderType,
    createdAt,
  };
}

/**
 * Normalizes StudentMember items from raw API responses.
 */
export function normalizeStudentMember(raw: any, index = 0): StudentMember {
  const id = (raw.id || raw._id || raw.member_id || raw.nim || raw.email || `mhs-${Date.now()}-${index}`).toString();
  const name = (raw.name || raw.nama || raw.full_name || 'Mahasiswa').toString();
  const nim = (raw.nim || raw.nomor_induk || raw.student_id || '').toString();
  const email = (raw.email || '').toString();
  const role: UserRole = ['super_admin', 'class_admin', 'class_member'].includes(raw.role || raw.peran)
    ? (raw.role || raw.peran)
    : 'class_member';
  const avatarUrl = raw.avatarUrl || raw.avatar_url || raw.avatar || ASSET_IMAGES.classMemberAvatar;
  const attendanceRate = Number(raw.attendanceRate ?? raw.attendance_rate ?? 100) || 100;
  const lastActive = (raw.lastActive || raw.last_active || 'Aktif').toString();

  return {
    id,
    name,
    nim,
    email,
    role,
    avatarUrl,
    attendanceRate,
    lastActive,
  };
}

export const DEFAULT_CAMPUS_API_URL = 'https://api-class.and-than.my.id/api';

const getEnvApiUrl = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
      const envUrl = ((import.meta.env.VITE_CUSTOM_API_URL || import.meta.env.VITE_ROLE_API_URL) as string | undefined)?.trim();
      if (envUrl) return envUrl;
    }
  } catch {
    // Non-Vite or test environment
  }
  return DEFAULT_CAMPUS_API_URL;
};

export const DEFAULT_DB_CONFIG: CustomDatabaseConfig = {
  provider: 'custom_api',
  apiBaseUrl: getEnvApiUrl(),
  apiKey: '',
  authHeaderMode: 'firebase_jwt',
  authHeaderName: 'Authorization',
  syncWithFirestoreBackup: false,
};

// Automatic cleanup of legacy browser configuration with static custom_key
if (typeof localStorage !== 'undefined') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DB_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed.authHeaderMode === 'custom_key' ||
        parsed.apiKey ||
        (parsed.apiBaseUrl && !parsed.apiBaseUrl.includes('api-class.and-than.my.id'))
      ) {
        localStorage.removeItem(STORAGE_KEY_DB_CONFIG);
      }
    }
  } catch {
    // ignore
  }
}

export const dataService = {
  normalizeUrl: normalizeApiUrl,

  getConfig(): CustomDatabaseConfig {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_DB_CONFIG);
        if (saved) {
          const parsed = JSON.parse(saved);
          // If legacy config had custom_key or old host, clear and return DEFAULT_DB_CONFIG
          if (
            parsed.authHeaderMode === 'custom_key' ||
            parsed.apiKey ||
            (parsed.apiBaseUrl && !parsed.apiBaseUrl.includes('api-class.and-than.my.id'))
          ) {
            localStorage.removeItem(STORAGE_KEY_DB_CONFIG);
            return DEFAULT_DB_CONFIG;
          }
          return {
            ...DEFAULT_DB_CONFIG,
            ...parsed,
            apiBaseUrl: normalizeApiUrl(parsed.apiBaseUrl || DEFAULT_CAMPUS_API_URL),
            provider: parsed.provider || 'custom_api',
            authHeaderMode: 'firebase_jwt',
            apiKey: '',
          };
        }
      }
    } catch (e) {
      console.warn('Error reading db config', e);
    }
    return DEFAULT_DB_CONFIG;
  },

  saveConfig(cfg: CustomDatabaseConfig) {
    try {
      const cleanCfg = {
        ...cfg,
        apiBaseUrl: normalizeApiUrl(cfg.apiBaseUrl),
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DB_CONFIG, JSON.stringify(cleanCfg));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('db-config-changed'));
      }
    } catch (e) {
      console.warn('Error saving db config', e);
    }
  },

  /**
   * Reset config back to official Campus API defaults and remove cached overrides
   */
  resetToDefault() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_DB_CONFIG);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('db-config-changed'));
      }
    } catch (e) {
      console.warn('Error resetting db config', e);
    }
  },

  /**
   * Resolves the appropriate authorization header for personal database API requests.
   * Sends Authorization: Bearer <Firebase ID Token> verified by Campus API backend.
   */
  async getAuthHeaderValue(cfg: CustomDatabaseConfig): Promise<string | null> {
    try {
      // Primary authentication: Firebase ID Token (JWT)
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        return `Bearer ${token}`;
      }
      if (cfg.authHeaderMode === 'custom_key' && cfg.apiKey) {
        return cfg.apiKey.startsWith('Bearer ') ? cfg.apiKey : `Bearer ${cfg.apiKey}`;
      }
      return null;
    } catch (err) {
      console.warn('Silent note: Could not obtain token for custom API header:', err);
      return null;
    }
  },

  /**
   * Robust test connection to personal REST API database.
   * Probes /me (with Firebase ID Token), /health, /schedules, or base URL.
   */
  async testConnection(
    rawUrl: string,
    apiKey?: string,
    headerMode: AuthHeaderMode = 'firebase_jwt',
    headerName = 'Authorization'
  ): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const startTime = performance.now();
    const cleanUrl = normalizeApiUrl(rawUrl);

    if (!cleanUrl) {
      return {
        success: false,
        latencyMs: 0,
        message: 'URL Server API Pribadi belum diisi. Masukkan URL endpoint server Anda (contoh: https://api-class.and-than.my.id/api).',
      };
    }

    try {
      new URL(cleanUrl);
    } catch {
      return {
        success: false,
        latencyMs: 0,
        message: `Format URL tidak valid: "${rawUrl}". Pastikan format URL benar (contoh: https://api-class.and-than.my.id/api).`,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const headers: Record<string, string> = {
        Accept: 'application/json, text/plain, */*',
      };

      if (auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          headers[headerName] = `Bearer ${token}`;
        } catch {
          // Token retrieval failed or user offline, continue test
        }
      } else if (headerMode === 'custom_key' && apiKey) {
        headers[headerName] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
      }

      // Probing strategy:
      // 1. /me (if logged in, confirms token verification and PostgreSQL role lookup)
      // 2. /schedules (checks data collection route)
      // 3. /health
      // 4. cleanUrl directly
      const endpointsToProbe = [
        `${cleanUrl}/me`,
        `${cleanUrl}/schedules`,
        `${cleanUrl}/health`,
        cleanUrl,
      ];

      let lastResponse: Response | null = null;
      let connectedEndpoint = '';

      for (const targetUrl of endpointsToProbe) {
        try {
          const res = await fetch(targetUrl, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });
          lastResponse = res;
          connectedEndpoint = targetUrl;
          if (res.ok) break;
          if (res.status === 401 || res.status === 403) break;
        } catch {
          // proceed to next candidate
        }
      }

      clearTimeout(timeout);
      const latencyMs = Math.round(performance.now() - startTime);

      if (!lastResponse) {
        throw new Error('Tidak ada respon dari server backend (Network timeout atau CORS blocked)');
      }

      const status = lastResponse.status;

      if (lastResponse.ok) {
        return {
          success: true,
          latencyMs,
          message: `Koneksi berhasil terhubung (${latencyMs}ms, HTTP ${status} OK). Backend PostgreSQL memverifikasi Firebase ID Token dengan sempurna.`,
        };
      }

      if (status === 401) {
        return {
          success: false,
          latencyMs,
          message: `Server merespon 401 Unauthorized. Pastikan Anda telah login dengan akun Google aktif sehingga browser mengirim Firebase ID Token yang valid.`,
        };
      }

      if (status === 403) {
        return {
          success: true,
          latencyMs,
          message: `Server terhubung (${latencyMs}ms, HTTP 403). Email Firebase Anda belum terdaftar aktif di tabel user_roles PostgreSQL. Hubungi Super Admin untuk menambahkan hak akses.`,
        };
      }

      if (status === 404) {
        return {
          success: true,
          latencyMs,
          message: `Server backend berhasil dijangkau (${latencyMs}ms). Pastikan rute /me, /schedules, /announcements, dan /reminders tersedia.`,
        };
      }

      return {
        success: false,
        latencyMs,
        message: `Server merespon dengan kode HTTP ${status} (${lastResponse.statusText}).`,
      };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMsg = err instanceof Error ? err.message : String(err);

      return {
        success: false,
        latencyMs,
        message: `Tidak dapat menjangkau server API pribadi (${errorMsg}). Pastikan backend Anda sedang berjalan dan mengizinkan CORS.`,
      };
    }
  },

  /**
   * Safely fetch data collections from a custom REST API.
   * Unwraps response envelopes ({ data: [...] }) and normalizes fields to ensure
   * the UI never crashes on snake_case or missing properties.
   */
  async fetchFromCustomApi<T>(
    path: string,
    cfg: CustomDatabaseConfig,
    keyHints: string[] = []
  ): Promise<T | null> {
    const cleanBaseUrl = normalizeApiUrl(cfg.apiBaseUrl);
    if (cfg.provider !== 'custom_api' || !cleanBaseUrl) return null;

    try {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const url = `${cleanBaseUrl}${cleanPath}`;
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      const authHeader = await this.getAuthHeaderValue(cfg);
      if (authHeader) {
        headers[cfg.authHeaderName || 'Authorization'] = authHeader;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`Custom API GET ${cleanPath} returned status ${res.status}`);
        return null;
      }

      const json = await res.json();

      // If callers request specific routes, apply auto-normalization
      if (cleanPath === '/schedules') {
        const rawArray = extractArrayPayload(json, ['schedules', ...keyHints]);
        return rawArray.map((item, idx) => normalizeSchedule(item, idx)) as unknown as T;
      }

      if (cleanPath === '/announcements') {
        const rawArray = extractArrayPayload(json, ['announcements', ...keyHints]);
        return rawArray.map((item, idx) => normalizeAnnouncement(item, idx)) as unknown as T;
      }

      if (cleanPath === '/reminders') {
        const rawArray = extractArrayPayload(json, ['reminders', ...keyHints]);
        return rawArray.map((item, idx) => normalizeReminder(item, idx)) as unknown as T;
      }

      if (cleanPath === '/users' || cleanPath === '/members') {
        const rawArray = extractArrayPayload(json, ['users', 'members', 'students', ...keyHints]);
        return rawArray.map((item, idx) => normalizeStudentMember(item, idx)) as unknown as T;
      }

      // Generic handler
      if (Array.isArray(json)) {
        return json as T;
      }

      const unwrapped = extractArrayPayload(json, keyHints);
      if (unwrapped.length > 0) {
        return unwrapped as unknown as T;
      }

      return json as T;
    } catch (e) {
      console.warn(`Custom API fetch failed for ${path} (falling back gracefully):`, e);
      return null;
    }
  },

  exportCompleteDatabaseJSON(): string {
    const data = {
      exportTimestamp: new Date().toISOString(),
      appName: 'UniClass Hub',
      schemaVersion: '1.0',
      databaseEngineTarget: ['PostgreSQL', 'MySQL', 'MongoDB', 'Supabase', 'REST API'],
      collections: {
        schedules: offlineStorage.getSchedules(),
        announcements: offlineStorage.getAnnouncements(),
        reminders: offlineStorage.getReminders(),
        readReceipts: offlineStorage.getReadReceipts(),
      },
    };
    return JSON.stringify(data, null, 2);
  },

  downloadDatabaseJSON(filename = 'uniclass-database-export.json') {
    const jsonStr = this.exportCompleteDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
