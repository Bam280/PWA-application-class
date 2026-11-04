import { ScheduleItem, Announcement, ReminderItem, ReadReceipt } from '../types';
import { offlineStorage } from './offlineStorage';

export type DatabaseProviderType = 'firestore' | 'custom_api' | 'local_offline';

export interface CustomDatabaseConfig {
  provider: DatabaseProviderType;
  apiBaseUrl: string;
  apiKey?: string;
  authHeaderName?: string;
  syncWithFirestoreBackup: boolean;
  lastConnectedAt?: string;
}

const STORAGE_KEY_DB_CONFIG = 'uniclass_custom_db_config';

export const DEFAULT_DB_CONFIG: CustomDatabaseConfig = {
  provider: 'firestore',
  apiBaseUrl: 'https://api.kampus-pribadi.ac.id/v1',
  apiKey: '',
  authHeaderName: 'Authorization',
  syncWithFirestoreBackup: true,
};

export const dataService = {
  getConfig(): CustomDatabaseConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DB_CONFIG);
      if (saved) return JSON.parse(saved);
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

  async testConnection(url: string, apiKey?: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const startTime = performance.now();
    try {
      // Validate valid URL format
      const parsed = new URL(url);
      
      // Perform ping or health check
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
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
          message: `Koneksi berhasil terhubung ke server pribadi (${latencyMs}ms, status: ${response.status}).`,
        };
      } else {
        return {
          success: false,
          latencyMs,
          message: `Server merespon dengan status ${response.status}: ${response.statusText}`,
        };
      }
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      // If simulated or CORS restricted, provide clear guidance
      return {
        success: false,
        latencyMs,
        message: `Tidak dapat menjangkau server (${errorMsg}). Pastikan CORS (Access-Control-Allow-Origin: *) diizinkan pada server backend pribadi Anda.`,
      };
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
