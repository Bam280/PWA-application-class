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
const BASE_URL = ((import.meta.env.VITE_ROLE_API_URL as string | undefined) ?? '').trim().replace(/\/+$/, '');
const TIMEOUT_MS = 8000;
const EXAMPLE_URL = 'https://api.domain-anda.com/api';

/**
 * Why VITE_ROLE_API_URL cannot be used, or null if it looks valid. A value that is not an absolute
 * URL (e.g. an API key pasted by mistake) would otherwise be resolved against the app's own page
 * and every call would get the app's index.html back.
 */
function baseUrlProblem(): string | null {
  if (!BASE_URL) {
    return `Alamat API role belum diatur. Isi VITE_ROLE_API_URL dengan alamat server API (mis. ${EXAMPLE_URL}), lalu build/jalankan ulang aplikasi.`;
  }
  let protocol = '';
  let hostname = '';
  try {
    ({ protocol, hostname } = new URL(BASE_URL));
  } catch {
    // Not an absolute URL; handled below.
  }
  if (protocol !== 'https:' && protocol !== 'http:') {
    return `VITE_ROLE_API_URL bukan alamat lengkap. Isi dengan URL server API yang diawali https:// (mis. ${EXAMPLE_URL}), bukan API key dan bukan alamat aplikasi ini.`;
  }
  const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && protocol === 'http:' && !isLocalHost) {
    return `VITE_ROLE_API_URL memakai http://, padahal aplikasi dibuka lewat https:// sehingga browser akan memblokirnya. Gunakan alamat API yang diawali https://.`;
  }
  return null;
}

const CONFIG_PROBLEM = baseUrlProblem();

export const isRoleApiConfigured = CONFIG_PROBLEM === null;

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

function isSameOriginAsApp(url: string): boolean {
  try {
    return typeof window !== 'undefined' && new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Explains a non-JSON reply: status, content type, final URL, a likely cause and the start of the body. */
function describeNonJsonResponse(res: Response, text: string, requestedUrl: string): string {
  const contentType = res.headers.get('content-type') || 'tidak ada';
  const head = text.slice(0, 4000);
  const lower = head.toLowerCase();
  const snippet = head
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  let hint: string;
  if (/^(<br\s*\/?>\s*)?(<b>)?\s*(warning|notice|deprecated|fatal error|parse error)\b/i.test(head)) {
    hint =
      'Ada pesan warning/error PHP yang tercetak sebelum JSON. Matikan display_errors di server (php.ini) atau perbaiki penyebab warning tersebut.';
  } else if (lower.includes('ngrok')) {
    hint =
      'Ini halaman peringatan ngrok. Kirim header "ngrok-skip-browser-warning" dari server/proxy, atau gunakan domain tanpa halaman peringatan.';
  } else if (isSameOriginAsApp(res.url || requestedUrl) && (lower.includes('<html') || lower.includes('<!doctype'))) {
    hint = `Permintaan terkirim ke aplikasi ini sendiri (${window.location.origin}), bukan ke server API. VITE_ROLE_API_URL harus berisi alamat lengkap server API Anda (mis. ${EXAMPLE_URL}), bukan alamat aplikasi ini.`;
  } else if (res.redirected) {
    hint = `Permintaan dialihkan (redirect) ke ${res.url}. Kemungkinan endpoint meminta login web atau alamat API salah.`;
  } else if (lower.includes('<html') || lower.includes('<!doctype')) {
    hint =
      'Server mengembalikan halaman HTML, bukan API. Periksa VITE_ROLE_API_URL (mis. kurang awalan /api, atau mengarah ke aplikasi web/frontend).';
  } else {
    hint = 'Pastikan endpoint mengembalikan JSON dengan header Content-Type: application/json.';
  }

  return `Respons API role bukan JSON (HTTP ${res.status}, Content-Type: ${contentType}, URL: ${res.url || requestedUrl}). ${hint}${
    snippet ? ` Awal respons: "${snippet}"` : ''
  }`;
}

async function request(method: string, path: string, body?: unknown, token?: string): Promise<unknown> {
  if (CONFIG_PROBLEM) throw new RoleApiError('config', CONFIG_PROBLEM);

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
  // Byte-order marks (e.g. from PHP files saved "UTF-8 with BOM") would break JSON.parse.
  const text = (await res.text()).replace(/^[\uFEFF\s]+/, '');
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Not our API answering (wrong URL, HTML page, PHP warning...). Never read its status as
      // "not registered"; report what actually came back so the cause is visible on screen.
      const message = describeNonJsonResponse(res, text, `${BASE_URL}${path}`);
      console.error('[roleApi]', message);
      throw new RoleApiError('invalid_response', message, res.status);
    }
  }

  // An empty 403/404 is not the API speaking (the contract answers with JSON), most likely a wrong
  // URL. Do not let it read as "not registered", which would sign the user out with a false reason.
  if (!text && (res.status === 403 || res.status === 404)) {
    const url = res.url || `${BASE_URL}${path}`;
    const selfHint = isSameOriginAsApp(url)
      ? `Permintaan terkirim ke aplikasi ini sendiri (${window.location.origin}), bukan ke server API. `
      : '';
    const message = `Server membalas HTTP ${res.status} tanpa isi (URL: ${url}). ${selfHint}Periksa VITE_ROLE_API_URL; API role seharusnya membalas JSON, mis. {"message": "Email belum terdaftar"}.`;
    console.error('[roleApi]', message);
    throw new RoleApiError('invalid_response', message, res.status);
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
      // Only a JSON 403/404 from the API itself means "not registered" (an HTML 404 means a wrong URL).
      if (err instanceof RoleApiError && (err.kind === 'forbidden' || err.kind === 'not_found')) {
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
