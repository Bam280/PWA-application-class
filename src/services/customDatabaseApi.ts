import { ScheduleItem, Announcement, ReminderItem, ReadReceipt } from '../types';
import { offlineStorage } from '../lib/offlineStorage';

export interface DatabaseApiConfig {
  baseUrl: string;
  apiKey?: string;
  authHeaderName?: string;
  timeoutMs?: number;
}

const STORAGE_KEY_CONFIG = 'uniclass_custom_database_api_config';

export const DEFAULT_DATABASE_API_CONFIG: DatabaseApiConfig = {
  baseUrl: 'https://api.kampus-pribadi.ac.id/v1',
  apiKey: '',
  authHeaderName: 'Authorization',
  timeoutMs: 5000,
};

type TokenProvider = () => Promise<string | null>;

/**
 * Client API Database Khusus yang MANDIRI (Decoupled dari Firebase).
 * Menangani seluruh query & mutasi data ke server / REST API database pribadi.
 */
class CustomDatabaseApiClient {
  private config: DatabaseApiConfig;
  private tokenProvider: TokenProvider | null = null;

  constructor() {
    this.config = this.loadConfig();
  }

  public loadConfig(): DatabaseApiConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Gagal membaca konfigurasi database API:', e);
    }
    return DEFAULT_DATABASE_API_CONFIG;
  }

  public saveConfig(newConfig: DatabaseApiConfig) {
    this.config = { ...newConfig };
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
      window.dispatchEvent(new Event('custom-db-api-config-changed'));
    } catch (e) {
      console.warn('Gagal menyimpan konfigurasi database API:', e);
    }
  }

  public getConfig(): DatabaseApiConfig {
    return { ...this.config };
  }

  /**
   * Menyuntikkan provider token (misal Firebase SSO JWT ID Token) tanpa perlu
   * mengimpor modul Firebase langsung ke dalam database API ini.
   */
  public setTokenProvider(provider: TokenProvider) {
    this.tokenProvider = provider;
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.config.apiKey) {
      headers[this.config.authHeaderName || 'Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.tokenProvider) {
      try {
        const token = await this.tokenProvider();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // Fallback jika token tidak dapat diambil
      }
    }

    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T | null> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const headers = await this.buildHeaders();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 5000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string> || {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Database API error [${response.status}] pada ${url}`);
        return null;
      }

      const data = await response.json();
      return data as T;
    } catch (err) {
      clearTimeout(timeout);
      console.warn(`Database API request gagal ke ${url} (menggunakan fallback lokal cache):`, err);
      return null;
    }
  }

  // ================= JADWAL KULIAH (SCHEDULES) =================
  public schedules = {
    getAll: async (): Promise<ScheduleItem[]> => {
      const remote = await this.request<ScheduleItem[]>('/schedules');
      if (remote && Array.isArray(remote) && remote.length > 0) {
        offlineStorage.saveSchedules(remote);
        return remote;
      }
      return offlineStorage.getSchedules();
    },

    create: async (item: ScheduleItem): Promise<boolean> => {
      const res = await this.request<ScheduleItem>('/schedules', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      return res !== null;
    },

    update: async (id: string, item: Partial<ScheduleItem>): Promise<boolean> => {
      const res = await this.request<ScheduleItem>(`/schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      });
      return res !== null;
    },

    delete: async (id: string): Promise<boolean> => {
      const res = await this.request<{ success: boolean }>(`/schedules/${id}`, {
        method: 'DELETE',
      });
      return res !== null;
    },
  };

  // ================= PENGUMUMAN (ANNOUNCEMENTS) =================
  public announcements = {
    getAll: async (): Promise<Announcement[]> => {
      const remote = await this.request<Announcement[]>('/announcements');
      if (remote && Array.isArray(remote) && remote.length > 0) {
        offlineStorage.saveAnnouncements(remote);
        return remote;
      }
      return offlineStorage.getAnnouncements();
    },

    create: async (item: Announcement): Promise<boolean> => {
      const res = await this.request<Announcement>('/announcements', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      return res !== null;
    },

    delete: async (id: string): Promise<boolean> => {
      const res = await this.request<{ success: boolean }>(`/announcements/${id}`, {
        method: 'DELETE',
      });
      return res !== null;
    },

    recordRead: async (announcementId: string, receipt: ReadReceipt): Promise<boolean> => {
      const res = await this.request<ReadReceipt>(`/announcements/${announcementId}/reads`, {
        method: 'POST',
        body: JSON.stringify(receipt),
      });
      return res !== null;
    },
  };

  // ================= PENGINGAT (REMINDERS) =================
  public reminders = {
    getAll: async (): Promise<ReminderItem[]> => {
      const remote = await this.request<ReminderItem[]>('/reminders');
      if (remote && Array.isArray(remote) && remote.length > 0) {
        offlineStorage.saveReminders(remote);
        return remote;
      }
      return offlineStorage.getReminders();
    },

    create: async (item: ReminderItem): Promise<boolean> => {
      const res = await this.request<ReminderItem>('/reminders', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      return res !== null;
    },

    update: async (id: string, item: Partial<ReminderItem>): Promise<boolean> => {
      const res = await this.request<ReminderItem>(`/reminders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      });
      return res !== null;
    },

    delete: async (id: string): Promise<boolean> => {
      const res = await this.request<{ success: boolean }>(`/reminders/${id}`, {
        method: 'DELETE',
      });
      return res !== null;
    },
  };

  // ================= TEST CONNECTION & HEALTH CHECK =================
  public async testConnection(customUrl?: string, customKey?: string): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
  }> {
    const url = customUrl || this.config.baseUrl;
    const start = performance.now();

    try {
      new URL(url);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (customKey) {
        headers['Authorization'] = `Bearer ${customKey}`;
      }

      let response: Response;
      try {
        response = await fetch(`${url.replace(/\/$/, '')}/health`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      } catch {
        response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      }

      clearTimeout(timeout);
      const latencyMs = Math.round(performance.now() - start);

      if (response.ok || response.status === 404 || response.status === 401) {
        return {
          success: true,
          latencyMs,
          message: `Koneksi berhasil terhubung (${latencyMs}ms, HTTP ${response.status}).`,
        };
      } else {
        return {
          success: false,
          latencyMs,
          message: `Server merespon dengan status error: ${response.status} ${response.statusText}`,
        };
      }
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        latencyMs,
        message: `Koneksi ke endpoint database khusus gagal (${errorMsg}). Pastikan backend aktif dan header CORS (Access-Control-Allow-Origin: *) diaktifkan.`,
      };
    }
  }
}

export const customDatabaseApi = new CustomDatabaseApiClient();
