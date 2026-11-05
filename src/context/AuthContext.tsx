import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { offlineStorage } from '../lib/offlineStorage';
import { ASSET_IMAGES } from '../lib/seedData';

interface AuthContextType {
  /** Profile derived from the active Firebase Auth session; null when signed out. */
  user: UserProfile | null;
  firebaseUser: User | null;
  role: UserRole;
  /** True until Firebase Auth has restored (or ruled out) a persisted session. */
  loading: boolean;
  /** Last sign-in error, already translated to a user-facing message. */
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAILS = [
  'julionedna23@gmail.com',
  'lukigio23@gmail.com',
  'superadmin@univ.ac.id',
  'dosen@univ.ac.id',
];

const CLASS_ADMIN_EMAILS = [
  'faiz.ramadhan@univ.ac.id',
  'ketuakelas@univ.ac.id',
  'admin@univ.ac.id',
];

function resolveRoleForEmail(email: string): UserRole {
  const emailLower = email.toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(emailLower)) return 'super_admin';
  if (CLASS_ADMIN_EMAILS.includes(emailLower)) return 'class_admin';

  // Check saved roster
  const members = offlineStorage.getClassMembers();
  const matched = members.find(m => m.email.toLowerCase() === emailLower);
  if (matched?.role) return matched.role;

  return 'class_member';
}

function buildProfile(fbUser: User): UserProfile {
  const email = fbUser.email || '';
  const role = resolveRoleForEmail(email);
  const rosterEntry = offlineStorage
    .getClassMembers()
    .find(m => m.email.toLowerCase() === email.toLowerCase());

  const fallbackAvatar =
    role === 'super_admin'
      ? ASSET_IMAGES.superAdminAvatar
      : role === 'class_admin'
      ? ASSET_IMAGES.classAdminAvatar
      : ASSET_IMAGES.classMemberAvatar;

  return {
    id: fbUser.uid,
    email,
    displayName: fbUser.displayName || rosterEntry?.name || email.split('@')[0] || 'Pengguna UniClass',
    role,
    nim: rosterEntry?.nim || '',
    major: 'ODP IT Batch 2026 · Kelas A',
    avatarUrl: fbUser.photoURL || fallbackAvatar,
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
      return 'Login Google belum diaktifkan di Firebase Authentication (Sign-in method → Google).';
    case 'auth/network-request-failed':
      return 'Tidak dapat terhubung ke Firebase. Periksa koneksi internet Anda lalu coba lagi.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan masuk. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/user-disabled':
      return 'Akun ini telah dinonaktifkan. Hubungi administrator.';
    case 'auth/internal-error':
    default:
      return 'Gagal masuk dengan Google. Silakan coba lagi.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // The simulated-offline toggle was a development control; never let a stale flag
    // keep a production session stuck offline.
    if (offlineStorage.getSimulatedOffline()) offlineStorage.setSimulatedOffline(false);
    return offlineStorage.isAppOnline();
  });

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

  // Firebase Auth is the single source of truth for the session. Its own persistence
  // (IndexedDB) restores the session on reload, including while offline.
  useEffect(() => {
    // Drop the legacy localStorage profile, which let sessions outlive Firebase sign-out.
    offlineStorage.saveUserProfile(null);

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setUser(fbUser ? buildProfile(fbUser) : null);
      setLoading(false);
    });

    // Never leave the user on the loading screen if Firebase Auth is slow to initialise;
    // a session that restores later still updates state through the listener above.
    const loadingTimeout = window.setTimeout(() => setLoading(false), 8000);

    return () => {
      unsubscribe();
      window.clearTimeout(loadingTimeout);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      // Popup (not redirect) is used because authDomain is on firebaseapp.com: the redirect flow
      // breaks under third-party storage partitioning in Safari and recent Chrome.
      // onAuthStateChanged picks up the new session and builds the profile.
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      const msg = describeAuthError(err);
      if (msg) setAuthError(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.error('Firebase sign-out failed:', err);
      // Clear local state anyway so the user is never stuck in a half-signed-in UI.
      setFirebaseUser(null);
      setUser(null);
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role: user?.role || 'class_member',
        loading,
        authError,
        clearAuthError,
        signInWithGoogle,
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
