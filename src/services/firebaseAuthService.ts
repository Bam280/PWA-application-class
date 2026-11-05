import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

const SUPER_ADMIN_EMAILS = ['lukigio23@gmail.com', 'superadmin@univ.ac.id'];
const CLASS_ADMIN_EMAILS = ['faiz.ramadhan@univ.ac.id', 'nabila.putri@univ.ac.id', 'admin@univ.ac.id', 'dosen@univ.ac.id'];

function resolveUserRole(email: string): UserRole {
  const emailLower = (email || '').toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(emailLower)) return 'super_admin';
  if (CLASS_ADMIN_EMAILS.includes(emailLower)) return 'class_admin';
  return 'class_member';
}

/**
 * Service khusus yang MURNI menangani autentikasi SSO Google dengan Firebase Auth.
 * Terpisah 100% dari layer penyimpanan database.
 */
export const firebaseAuthService = {
  /**
   * Login menggunakan Google SSO Popup
   */
  async signInWithGoogle(): Promise<UserProfile> {
    const res = await signInWithPopup(auth, googleProvider);
    const email = res.user.email || '';
    const role = resolveUserRole(email);

    return {
      id: res.user.uid,
      email,
      displayName: res.user.displayName || (role === 'super_admin' ? 'Super Admin' : role === 'class_admin' ? 'Ketua Kelas' : 'Mahasiswa'),
      role,
      nim: role === 'super_admin' ? undefined : '2301092001',
      major: 'Teknik Informatika (S-1)',
      avatarUrl: res.user.photoURL || undefined,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Logout dari sesi Firebase SSO
   */
  async signOut(): Promise<void> {
    await fbSignOut(auth);
  },

  /**
   * Mengambil Firebase JWT ID Token pengguna saat ini
   * Berguna untuk diteruskan ke Database API Pribadi sebagai otorisasi Bearer token
   */
  async getIdToken(): Promise<string | null> {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('Gagal mengambil Firebase ID Token:', e);
      return null;
    }
  },

  /**
   * Mendengarkan perubahan status login Firebase
   */
  onAuthStateChange(callback: (user: User | null, profile: UserProfile | null) => void) {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const email = fbUser.email || '';
        const role = resolveUserRole(email);
        const profile: UserProfile = {
          id: fbUser.uid,
          email,
          displayName: fbUser.displayName || (role === 'super_admin' ? 'Super Admin' : role === 'class_admin' ? 'Ketua Kelas' : 'Mahasiswa'),
          role,
          nim: role === 'super_admin' ? undefined : '2301092001',
          major: 'Teknik Informatika (S-1)',
          avatarUrl: fbUser.photoURL || undefined,
          createdAt: new Date().toISOString(),
        };
        callback(fbUser, profile);
      } else {
        callback(null, null);
      }
    });
  },

  /**
   * Mendapatkan pengguna Firebase saat ini
   */
  getCurrentFirebaseUser(): User | null {
    return auth.currentUser;
  },
};
