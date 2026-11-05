import { ScheduleItem, Announcement, ReminderItem, ReadReceipt } from '../types';
import { offlineStorage } from './offlineStorage';
import { auth } from './firebase';

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

export const DEFAULT_DB_CONFIG: CustomDatabaseConfig = {
  provider: 'firestore',
  apiBaseUrl: 'https://api.kampus-pribadi.ac.id/v1',
  apiKey: '',
  authHeaderMode: 'firebase_jwt',
  authHeaderName: 'Authorization',
  syncWithFirestoreBackup: true,
};

export const dataService = {
  getConfig(): CustomDatabaseConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DB_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_DB_CONFIG,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('Error reading db config', e);
    }
    return DEFAULT_DB_CONFIG;
  },

  saveConfig(cfg: CustomDatabaseConfig) {
    try {
      localStorage.setItem(STORAGE_KEY_DB_CONFIG, JSON.stringify(cfg));
      window.dispatchEvent(new Event('db-config-changed'));
    } catch (e) {
      console.warn('Error saving db config', e);
    }
  },

  /**
   * Resolves the appropriate authorization header for personal database API requests.
   * CRITICAL GUARANTEE: This is completely isolated from Firebase Auth state.
   * Calling this or failing to get a token NEVER logs the user out or alters auth.
   */
  async getAuthHeaderValue(cfg: CustomDatabaseConfig): Promise<string | null> {
    try {
      const mode = cfg.authHeaderMode || (cfg.apiKey ? 'custom_key' : 'firebase_jwt');
      if (mode === 'firebase_jwt') {
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken();
          return `Bearer ${token}`;
        }
        return null;
      }
      if (mode === 'custom_key' && cfg.apiKey) {
        return `Bearer ${cfg.apiKey}`;
      }
      return null;
    } catch (err) {
      console.warn('Silent note: Could not obtain Firebase token for custom API header:', err);
      return null;
    }
  },

  async testConnection(
    url: string,
    apiKey?: string,
    headerMode: AuthHeaderMode = 'firebase_jwt',
    headerName = 'Authorization'
  ): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const startTime = performance.now();
    try {
      // Validate valid URL format
      const parsed = new URL(url);

      // Perform ping or health check
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (headerMode === 'firebase_jwt' && auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          headers[headerName] = `Bearer ${token}`;
        } catch {
          // Token retrieval failed or user offline, continue test without token
        }
      } else if (headerMode === 'custom_key' && apiKey) {
        headers[headerName] = `Bearer ${apiKey}`;
      }

      // Try hitting the baseUrl or /health endpoint
      let response: Response;
      try {
        response = await fetch(`${parsed.origin}${parsed.pathname.replace(/\/$/, '')}/health`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      } catch {
        // Fallback to baseUrl directly
        response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      }

      clearTimeout(timeout);
      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok || response.status === 404 || response.status === 401) {
        return {
          success: true,
          latencyMs,
          message: `Koneksi berhasil terhubung ke server pribadi (${latencyMs}ms, status HTTP ${response.status}). Autentikasi Firebase Auth tetap aktif independen.`,
        };
      } else {
        return {
          success: false,
          latencyMs,
          message: `Server merespon dengan status ${response.status}: ${response.statusText}. Autentikasi Firebase tidak terpengaruh.`,
        };
      }
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMsg = err instanceof Error ? err.message : String(err);

      return {
        success: false,
        latencyMs,
        message: `Tidak dapat menjangkau server (${errorMsg}). Pastikan CORS (Access-Control-Allow-Origin: *) diizinkan pada server backend pribadi. Autentikasi Firebase Auth Anda tetap 100% aman dan aktif.`,
      };
    }
  },

  /**
   * Safely fetch data collections from a custom REST API.
   * If the custom API fails or is offline, this returns null so the app seamlessly
   * falls back to cached offline storage or Firestore without affecting Firebase Auth.
   */
  async fetchFromCustomApi<T>(path: string, cfg: CustomDatabaseConfig): Promise<T | null> {
    if (cfg.provider !== 'custom_api' || !cfg.apiBaseUrl) return null;
    try {
      const url = `${cfg.apiBaseUrl.replace(/\/$/, '')}${path}`;
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      const authHeader = await this.getAuthHeaderValue(cfg);
      if (authHeader) {
        headers[cfg.authHeaderName || 'Authorization'] = authHeader;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`Custom API GET ${path} returned status ${res.status}`);
        return null;
      }
      return (await res.json()) as T;
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
