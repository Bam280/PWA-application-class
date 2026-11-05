import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { offlineStorage } from '../lib/offlineStorage';
import { ASSET_IMAGES } from '../lib/seedData';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: User | null;
  role: UserRole;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsDemo: (role: UserRole) => void;
  signOut: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  isOnline: boolean;
  toggleSimulatedOffline: () => void;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => offlineStorage.getUserProfile());
  const [loading, setLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(() => offlineStorage.isAppOnline());

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

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const assignedRole = resolveRoleForEmail(fbUser.email || '');
        const userProfile: UserProfile = {
          id: fbUser.uid,
          email: fbUser.email || 'user@univ.ac.id',
          displayName: fbUser.displayName || 'Pengguna UniClass',
          role: assignedRole,
          nim: assignedRole === 'super_admin' ? 'Dosen-TI-01' : '2301092001',
          major: 'Teknik Informatika (S-1)',
          avatarUrl: fbUser.photoURL || (
            assignedRole === 'super_admin'
              ? ASSET_IMAGES.superAdminAvatar
              : assignedRole === 'class_admin'
              ? ASSET_IMAGES.classAdminAvatar
              : ASSET_IMAGES.classMemberAvatar
          ),
          createdAt: new Date().toISOString(),
        };
        setUser(userProfile);
        offlineStorage.saveUserProfile(userProfile);
      } else {
        // Fallback to cached profile or default Super Admin profile for seamless preview
        const cached = offlineStorage.getUserProfile();
        if (!cached) {
          const defaultAdmin: UserProfile = {
            id: 'super-admin-1',
            email: 'julionedna23@gmail.com',
            displayName: 'Dian Pratama, M.Kom. (Super Admin)',
            role: 'super_admin',
            nim: 'Dosen-TI-01',
            major: 'Koordinator Mata Kuliah & Prodi TI',
            avatarUrl: ASSET_IMAGES.superAdminAvatar,
            createdAt: new Date().toISOString(),
          };
          setUser(defaultAdmin);
          offlineStorage.saveUserProfile(defaultAdmin);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const res = await signInWithPopup(auth, googleProvider);
      const assignedRole = resolveRoleForEmail(res.user.email || '');
      const userProfile: UserProfile = {
        id: res.user.uid,
        email: res.user.email || '',
        displayName: res.user.displayName || 'Pengguna Google',
        role: assignedRole,
        nim: assignedRole === 'super_admin' ? 'Dosen-TI-01' : '2301092001',
        major: 'Teknik Informatika (S-1)',
        avatarUrl: res.user.photoURL || ASSET_IMAGES.superAdminAvatar,
        createdAt: new Date().toISOString(),
      };
      setUser(userProfile);
      offlineStorage.saveUserProfile(userProfile);
    } catch (err) {
      console.warn('Google Sign-In Popup notice (fallback active):', err);
    } finally {
      setLoading(false);
    }
  };

  const signInAsDemo = (targetRole: UserRole) => {
    let profile: UserProfile;

    if (targetRole === 'super_admin') {
      profile = {
        id: 'super-admin-1',
        email: 'julionedna23@gmail.com',
        displayName: 'Dian Pratama, M.Kom. (Head of IT Learning)',
        role: 'super_admin',
        nim: 'NIP: BNI-CORPU-019',
        major: 'IT Learning & Corporate University BNI',
        avatarUrl: ASSET_IMAGES.superAdminAvatar,
        createdAt: new Date().toISOString(),
      };
    } else if (targetRole === 'class_admin') {
      profile = {
        id: 'class-admin-1',
        email: 'faiz.ramadhan@univ.ac.id',
        displayName: 'Ahmad Faiz Ramadhan (Ketua Angkatan ODP IT)',
        role: 'class_admin',
        nim: 'NIP: ODP-IT-2026-002',
        major: 'ODP IT Batch 2026 · Kelas A',
        avatarUrl: ASSET_IMAGES.classAdminAvatar,
        createdAt: new Date().toISOString(),
      };
    } else {
      profile = {
        id: 'class-member-1',
        email: 'lukigio23@gmail.com',
        displayName: 'Luki Giovani (Trainee ODP IT)',
        role: 'class_member',
        nim: 'NIP: ODP-IT-2026-001',
        major: 'ODP IT Batch 2026 · Kelas A',
        avatarUrl: ASSET_IMAGES.classMemberAvatar,
        createdAt: new Date().toISOString(),
      };
    }

    setUser(profile);
    offlineStorage.saveUserProfile(profile);
  };

  const switchRole = (newRole: UserRole) => {
    signInAsDemo(newRole);
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn('Firebase signout note:', err);
    }
    setUser(null);
    offlineStorage.saveUserProfile(null);
  };

  const toggleSimulatedOffline = () => {
    const current = offlineStorage.getSimulatedOffline();
    offlineStorage.setSimulatedOffline(!current);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role: user?.role || 'super_admin',
        loading,
        signInWithGoogle,
        signInAsDemo,
        signOut,
        switchRole,
        isOnline,
        toggleSimulatedOffline,
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
