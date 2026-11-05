import { auth } from './firebase';
import { StudentMember, UserRole } from '../types';
import { ASSET_IMAGES } from './seedData';

/**
 * Client for the role-management API.
 *
 * Firebase Auth only proves who the user is (verified Google email). The role itself lives
 * in the organisation's own database and is served by this API. Every request carries the
 * Firebase ID token; the API must verify it and read the email from the token, never from
 * the request. Contract: docs/ROLE_API.md.
 *
 * The base URL is fixed at build time (VITE_ROLE_API_URL) on purpose: a URL editable in the
 * browser would let anyone point the app at an API that answers "super_admin".
 */
const BASE_URL = (import.meta.env.VITE_ROLE_API_URL as string | undefined)?.trim().replace(/\/+$/, '') || '';
const TIMEOUT_MS = 8000;

export const isRoleApiConfigured = BASE_URL.length > 0;

export type RoleApiErrorKind =
  | 'config' // VITE_ROLE_API_URL is not set
  | 'not_registered' // /me answered 403 or 404: email is not in the role table
  | 'unauthorized' // 401: token rejected
  | 'forbidden' // 403 on a management endpoint: caller lacks permission
  | 'not_found' // 404 on a management endpoint
  | 'conflict' // 409: e.g. email already registered
  | 'invalid_response'
  | 'network'
  | 'server';

export class RoleApiError extends Error {
  constructor(
    public kind: RoleApiErrorKind,
    message: string,
    public status?: number,
    /** The `message`/`error` field sent by the API itself, if any. */
    public serverMessage?: string
  ) {
    super(message);
    this.name = 'RoleApiError';
  }
}

export interface RoleApiUser {
  id: string;
  email: string;
  name: string;
  nim: string;
  role: UserRole;
  avatarUrl?: string;
  attendanceRate?: number;
  lastActive?: string;
}

/** Accepts the exact role values plus common aliases a backend may already use. */
export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (v === 'super_admin' || v === 'superadmin') return 'super_admin';
  if (v === 'class_admin' || v === 'admin' || v === 'admin_kelas' || v === 'ketua_kelas') return 'class_admin';
  if (v === 'class_member' || v === 'member' || v === 'student' || v === 'mahasiswa' || v === 'trainee')
    return 'class_member';
  return null;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

/** Maps one user record from the API (camelCase or snake_case) to the app's shape. */
function parseUser(raw: unknown): RoleApiUser {
  if (!raw || typeof raw !== 'object') {
    throw new RoleApiError('invalid_response', 'Respons API pengguna tidak valid.');
  }
  const o = raw as Record<string, unknown>;
  const email = String(pick(o, 'email') ?? '').trim();
  const role = normalizeRole(pick(o, 'role'));
  if (!email || !role) {
    throw new RoleApiError(
      'invalid_response',
      `Respons API harus berisi "email" dan "role" (super_admin | class_admin | class_member). Diterima: ${JSON.stringify(raw).slice(0, 200)}`
    );
  }
  const attendance = Number(pick(o, 'attendanceRate', 'attendance_rate'));
  return {
    id: String(pick(o, 'id', 'uid', 'user_id') ?? email),
    email,
    name: String(pick(o, 'name', 'displayName', 'display_name', 'full_name') ?? email.split('@')[0]),
    nim: String(pick(o, 'nim', 'nip', 'employee_id') ?? ''),
    role,
    avatarUrl: (pick(o, 'avatarUrl', 'avatar_url', 'photo_url') as string | undefined) || undefined,
    attendanceRate: Number.isFinite(attendance) ? attendance : undefined,
    lastActive: (pick(o, 'lastActive', 'last_active', 'last_login_at') as string | undefined) || undefined,
  };
}

async function request(method: string, path: string, body?: unknown, token?: string): Promise<unknown> {
  if (!isRoleApiConfigured) {
    throw new RoleApiError(
      'config',
      'Alamat API role belum diatur. Isi VITE_ROLE_API_URL di file .env lalu jalankan ulang aplikasi.'
    );
  }

  const idToken = token ?? (await auth.currentUser?.getIdToken());
  if (!idToken) throw new RoleApiError('unauthorized', 'Tidak ada sesi Firebase yang aktif.', 401);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    throw new RoleApiError(
      'network',
      aborted
        ? 'Server API role tidak merespons (timeout).'
        : 'Tidak dapat menghubungi server API role. Periksa koneksi, alamat API, dan pengaturan CORS.'
    );
  } finally {
    window.clearTimeout(timer);
  }

  if (res.status === 204) return null;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (res.ok) throw new RoleApiError('invalid_response', 'Respons API role bukan JSON.', res.status);
    }
  }

  if (!res.ok) {
    const serverMsg =
      data && typeof data === 'object' ? (pick(data as Record<string, unknown>, 'message', 'error') as string) : '';
    const kind: RoleApiErrorKind =
      res.status === 401
        ? 'unauthorized'
        : res.status === 403
        ? 'forbidden'
        : res.status === 404
        ? 'not_found'
        : res.status === 409
        ? 'conflict'
        : 'server';
    throw new RoleApiError(kind, serverMsg || `Server API role membalas status ${res.status}.`, res.status, serverMsg || undefined);
  }
  return data;
}

/** Unwraps `{ data: ... }` envelopes some APIs use. */
function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
    return (data as { data: unknown }).data;
  }
  return data;
}

export const roleApi = {
  /** Role of the signed-in user. 403/404 means the email is not registered. */
  async getMe(idToken: string): Promise<RoleApiUser> {
    try {
      return parseUser(unwrap(await request('GET', '/me', undefined, idToken)));
    } catch (err) {
      if (err instanceof RoleApiError && (err.status === 403 || err.status === 404)) {
        throw new RoleApiError('not_registered', err.message, err.status, err.serverMessage);
      }
      throw err;
    }
  },

  async listUsers(): Promise<RoleApiUser[]> {
    const data = unwrap(await request('GET', '/users'));
    if (!Array.isArray(data)) {
      throw new RoleApiError('invalid_response', 'GET /users harus mengembalikan array pengguna.');
    }
    return data.map(parseUser);
  },

  async createUser(input: { email: string; name: string; nim?: string; role: UserRole }): Promise<RoleApiUser> {
    return parseUser(unwrap(await request('POST', '/users', input)));
  },

  async updateUserRole(id: string, role: UserRole): Promise<RoleApiUser | null> {
    const data = unwrap(await request('PATCH', `/users/${encodeURIComponent(id)}`, { role }));
    return data ? parseUser(data) : null;
  },

  async deleteUser(id: string): Promise<void> {
    await request('DELETE', `/users/${encodeURIComponent(id)}`);
  },
};

export function toStudentMember(u: RoleApiUser): StudentMember {
  return {
    id: u.id,
    name: u.name,
    nim: u.nim,
    email: u.email,
    role: u.role,
    avatarUrl:
      u.avatarUrl ||
      (u.role === 'super_admin'
        ? ASSET_IMAGES.superAdminAvatar
        : u.role === 'class_admin'
        ? ASSET_IMAGES.classAdminAvatar
        : ASSET_IMAGES.classMemberAvatar),
    attendanceRate: u.attendanceRate ?? 0,
    lastActive: u.lastActive || '-',
  };
}
