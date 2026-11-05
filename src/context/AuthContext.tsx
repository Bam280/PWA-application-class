import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { offlineStorage } from '../lib/offlineStorage';
import { ASSET_IMAGES } from '../lib/seedData';
import { roleApi, RoleApiError, RoleApiUser } from '../lib/roleApi';

interface AuthContextType {
  /** Signed-in user with a role confirmed by the role API; null when signed out or not yet resolved. */
  user: UserProfile | null;
  firebaseUser: User | null;
  role: UserRole;
  /** True while Firebase restores the session or the role API is being consulted. */
  loading: boolean;
  /** Sign-in error for the login page, already translated to a user-facing message. */
  authError: string | null;
  clearAuthError: () => void;
  /**
   * Set when Firebase sign-in succeeded but the role could not be loaded (API down, misconfigured)
   * and no cached role exists. The app shows a retry screen instead of guessing a role.
   */
  accessError: string | null;
  /** Re-asks the role API for the current user (after an error, or after their role changed). */
  refreshAccess: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Email & password sign-in, reserved for admins (enforced after the role lookup). */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Sends a Firebase password-reset email. Resolves to a message for the login page. */
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Last role confirmed by the API, so a restored session still works offline.
// Keyed by Firebase uid and cleared on sign-out.
const ACCESS_CACHE_KEY = 'uniclass_access_cache';

interface AccessCache {
  uid: string;
  user: RoleApiUser;
  cachedAt: string;
}

function readAccessCache(uid: string): RoleApiUser | null {
  try {
    const raw = localStorage.getItem(ACCESS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccessCache;
    return parsed.uid === uid ? parsed.user : null;
  } catch {
    return null;
  }
}

function writeAccessCache(uid: string, user: RoleApiUser | null) {
  try {
    if (user) {
      const entry: AccessCache = { uid, user, cachedAt: new Date().toISOString() };
      localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(entry));
    } else {
      localStorage.removeItem(ACCESS_CACHE_KEY);
    }
  } catch {
    // Storage unavailable (private mode); offline fallback just won't be available.
  }
}

function buildProfile(fbUser: User, access: RoleApiUser): UserProfile {
  const fallbackAvatar =
    access.role === 'super_admin'
      ? ASSET_IMAGES.superAdminAvatar
      : access.role === 'class_admin'
      ? ASSET_IMAGES.classAdminAvatar
      : ASSET_IMAGES.classMemberAvatar;

  return {
    id: fbUser.uid,
    email: fbUser.email || access.email,
    displayName: access.name || fbUser.displayName || (fbUser.email || '').split('@')[0] || 'Pengguna UniClass',
    role: access.role,
    nim: access.nim || '',
    major: 'ODP IT Batch 2026 · Kelas A',
    avatarUrl: fbUser.photoURL || access.avatarUrl || fallbackAvatar,
    createdAt: fbUser.metadata.creationTime
      ? new Date(fbUser.metadata.creationTime).toISOString()
      : new Date().toISOString(),
  };
}

/** Maps Firebase Auth error codes to messages for the login screen. Returns null for user-initiated cancels. */
function describeAuthError(err: unknown): string | null {
  const code = err instanceof FirebaseError ? err.code : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/popup-blocked':
      return 'Jendela login diblokir oleh browser. Izinkan pop-up untuk situs ini, lalu tekan tombol masuk lagi.';
    case 'auth/unauthorized-domain':
      return `Domain ${window.location.hostname} belum diizinkan di Firebase Authentication. Tambahkan domain ini di Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'Metode login ini belum diaktifkan di Firebase Console → Authentication → Sign-in method.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password salah.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/missing-password':
      return 'Password wajib diisi.';
    case 'auth/network-request-failed':
      return 'Tidak dapat terhubung ke Firebase. Periksa koneksi internet Anda lalu coba lagi.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan masuk. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/user-disabled':
      return 'Akun ini telah dinonaktifkan. Hubungi administrator.';
    case 'auth/internal-error':
    default:
      return 'Gagal masuk. Silakan coba lagi.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [resolvingAccess, setResolvingAccess] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  // True when the current role came from the offline cache and should be re-checked once online.
  const [roleFromCache, setRoleFromCache] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // The simulated-offline toggle was a development control; never let a stale flag
    // keep a production session stuck offline.
    if (offlineStorage.getSimulatedOffline()) offlineStorage.setSimulatedOffline(false);
    return offlineStorage.isAppOnline();
  });
  // Ignores results of an older role lookup when a newer one (or a sign-out) has started.
  const accessRequestId = useRef(0);

  // Listen to network status changes
  useEffect(() => {
    const handleStatus = () => {
      setIsOnline(offlineStorage.isAppOnline());
    };

    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    window.addEventListener('offline-status-changed', handleStatus);

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      window.removeEventListener('offline-status-changed', handleStatus);
    };
  }, []);

  /**
   * Firebase proves the identity; the role API decides the role. The API verifies the ID token
   * and looks the verified email up in the role table.
   */
  const resolveAccess = useCallback(async (fbUser: User) => {
    const requestId = ++accessRequestId.current;
    setResolvingAccess(true);
    setAccessError(null);
    // How this session was signed in ('google.com', 'password', ...). Falls back to the account's
    // linked providers when the token cannot be read (e.g. offline with an expired token).
    let signInProvider: string | null = fbUser.providerData.every(p => p.providerId === 'password')
      ? 'password'
      : null;

    /** Ends the Firebase session and explains why on the login page. */
    const rejectSession = async (message: string) => {
      writeAccessCache(fbUser.uid, null);
      setUser(null);
      setAuthError(message);
      accessRequestId.current++;
      setResolvingAccess(false);
      await fbSignOut(auth).catch(() => undefined);
    };
    const PASSWORD_ADMIN_ONLY =
      'Login dengan email & password khusus untuk admin. Silakan masuk dengan akun Google Anda.';

    try {
      const tokenResult = await fbUser.getIdTokenResult();
      signInProvider = tokenResult.signInProvider ?? signInProvider;
      const access = await roleApi.getMe(tokenResult.token);
      if (requestId !== accessRequestId.current) return;

      // Email & password is an admin-only door; members must use Google.
      if (signInProvider === 'password' && access.role === 'class_member') {
        await rejectSession(PASSWORD_ADMIN_ONLY);
        return;
      }

      writeAccessCache(fbUser.uid, access);
      setUser(buildProfile(fbUser, access));
      setRoleFromCache(false);

      // If the API mirrors the role into Firebase custom claims (for Firestore rules),
      // refresh the token once so the new claim is used immediately.
      if (tokenResult.claims.role !== undefined && tokenResult.claims.role !== access.role) {
        fbUser.getIdToken(true).catch(() => undefined);
      }
    } catch (err) {
      if (requestId !== accessRequestId.current) return;
      const apiErr = err instanceof RoleApiError ? err : null;

      if (apiErr?.kind === 'not_registered') {
        await rejectSession(
          apiErr.status === 403 && apiErr.serverMessage
            ? apiErr.serverMessage
            : `Email ${fbUser.email} belum terdaftar di sistem. Hubungi admin untuk didaftarkan.`
        );
        return;
      }
      if (apiErr?.kind === 'unauthorized') {
        await rejectSession('Sesi tidak dapat diverifikasi oleh server. Silakan masuk kembali.');
        return;
      }

      // API unreachable, misconfigured or broken: fall back to the last confirmed role if we have one.
      const cached = readAccessCache(fbUser.uid);
      if (cached && apiErr?.kind !== 'config') {
        if (signInProvider === 'password' && cached.role === 'class_member') {
          await rejectSession(PASSWORD_ADMIN_ONLY);
          return;
        }
        setUser(buildProfile(fbUser, cached));
        setRoleFromCache(true);
        console.warn('Role API unavailable, using cached role:', err);
      } else {
        setUser(null);
        setAccessError(
          apiErr?.message ||
            (err instanceof FirebaseError
              ? describeAuthError(err) || 'Gagal memverifikasi sesi.'
              : 'Gagal memuat hak akses dari server.')
        );
        console.error('Role lookup failed:', err);
      }
    } finally {
      if (requestId === accessRequestId.current) setResolvingAccess(false);
    }
  }, []);

  // Firebase Auth is the single source of truth for who is signed in. Its own persistence
  // (IndexedDB) restores the session on reload, including while offline.
  useEffect(() => {
    // Drop legacy localStorage data that let sessions or roles outlive the server's say-so.
    offlineStorage.saveUserProfile(null);

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthReady(true);
      if (fbUser) {
        resolveAccess(fbUser);
      } else {
        accessRequestId.current++;
        setUser(null);
        setAccessError(null);
        setRoleFromCache(false);
        setResolvingAccess(false);
      }
    });

    // Never leave the user on the loading screen if Firebase Auth is slow to initialise;
    // a session that restores later still updates state through the listener above.
    const loadingTimeout = window.setTimeout(() => setAuthReady(true), 8000);

    return () => {
      unsubscribe();
      window.clearTimeout(loadingTimeout);
    };
  }, [resolveAccess]);

  // A role taken from the offline cache is re-confirmed with the API as soon as we are back online.
  useEffect(() => {
    if (isOnline && roleFromCache && firebaseUser) {
      resolveAccess(firebaseUser);
    }
  }, [isOnline, roleFromCache, firebaseUser, resolveAccess]);

  const refreshAccess = useCallback(async () => {
    if (firebaseUser) await resolveAccess(firebaseUser);
  }, [firebaseUser, resolveAccess]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      // Popup (not redirect) is used because authDomain is on firebaseapp.com: the redirect flow
      // breaks under third-party storage partitioning in Safari and recent Chrome.
      // onAuthStateChanged picks up the new session and resolves the role.
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      const msg = describeAuthError(err);
      if (msg) setAuthError(msg);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      // onAuthStateChanged resolves the role; non-admins are signed out again there.
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      console.error('Email sign-in failed:', err);
      const msg = describeAuthError(err);
      if (msg) setAuthError(msg);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return { ok: false, message: 'Isi email akun admin terlebih dahulu.' };
    try {
      await sendPasswordResetEmail(auth, trimmed);
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      // Never reveal whether an account exists; only report errors the user can fix.
      if (code !== 'auth/user-not-found') {
        return { ok: false, message: describeAuthError(err) || 'Gagal mengirim email reset password.' };
      }
    }
    return {
      ok: true,
      message: `Jika ${trimmed} terdaftar sebagai akun admin, tautan untuk mengatur ulang password telah dikirim ke email tersebut.`,
    };
  }, []);

  const signOut = useCallback(async () => {
    if (firebaseUser) writeAccessCache(firebaseUser.uid, null);
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.error('Firebase sign-out failed:', err);
      // Clear local state anyway so the user is never stuck in a half-signed-in UI.
      accessRequestId.current++;
      setFirebaseUser(null);
      setUser(null);
      setAccessError(null);
    }
  }, [firebaseUser]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role: user?.role || 'class_member',
        // A background re-check (back online, after a role change) must not blank the app.
        loading: !authReady || (resolvingAccess && !user),
        authError,
        clearAuthError,
        accessError,
        refreshAccess,
        signInWithGoogle,
        signInWithEmail,
        sendPasswordReset,
        signOut,
        isOnline,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
