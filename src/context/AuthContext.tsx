import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { offlineStorage } from '../lib/offlineStorage';

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

const ADMIN_EMAILS = ['lukigio23@gmail.com', 'admin@univ.ac.id', 'dosen@univ.ac.id'];

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
        const emailLower = (fbUser.email || '').toLowerCase();
        const isAdmin = ADMIN_EMAILS.includes(emailLower);
        const userProfile: UserProfile = {
          id: fbUser.uid,
          email: fbUser.email || 'user@univ.ac.id',
          displayName: fbUser.displayName || 'Mahasiswa Terdaftar',
          role: isAdmin ? 'admin' : 'student',
          nim: isAdmin ? undefined : '2301092001',
          major: 'Teknik Informatika (S-1)',
          avatarUrl: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
        };
        setUser(userProfile);
        offlineStorage.saveUserProfile(userProfile);
      } else {
        // If no firebase user, fallback to cached offline profile or default student profile
        const cached = offlineStorage.getUserProfile();
        if (!cached) {
          // Default profile so user is not stuck on blank screen
          const defaultStudent: UserProfile = {
            id: 'mhs-1',
            email: 'LukiGio23@gmail.com',
            displayName: 'Luki Giovani',
            role: 'student',
            nim: '2301092001',
            major: 'Teknik Informatika (S-1)',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            createdAt: new Date().toISOString(),
          };
          setUser(defaultStudent);
          offlineStorage.saveUserProfile(defaultStudent);
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
      const emailLower = (res.user.email || '').toLowerCase();
      const isAdmin = ADMIN_EMAILS.includes(emailLower);
      const userProfile: UserProfile = {
        id: res.user.uid,
        email: res.user.email || '',
        displayName: res.user.displayName || 'Pengguna Google',
        role: isAdmin ? 'admin' : 'student',
        nim: isAdmin ? undefined : '2301092001',
        major: 'Teknik Informatika (S-1)',
        avatarUrl: res.user.photoURL || undefined,
        createdAt: new Date().toISOString(),
      };
      setUser(userProfile);
      offlineStorage.saveUserProfile(userProfile);
    } catch (err) {
      console.warn('Google Sign-In Popup error, keeping demo session:', err);
    } finally {
      setLoading(false);
    }
  };

  const signInAsDemo = (role: UserRole) => {
    const profile: UserProfile = role === 'admin'
      ? {
          id: 'admin-1',
          email: 'LukiGio23@gmail.com',
          displayName: 'Dian Pratama, M.Kom. (Dosen & Admin)',
          role: 'admin',
          major: 'Koordinator Mata Kuliah & Prodi TI',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
        }
      : {
          id: 'mhs-1',
          email: 'LukiGio23@gmail.com',
          displayName: 'Luki Giovani',
          role: 'student',
          nim: '2301092001',
          major: 'Teknik Informatika (S-1)',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          createdAt: new Date().toISOString(),
        };

    setUser(profile);
    offlineStorage.saveUserProfile(profile);
  };

  const switchRole = (newRole: UserRole) => {
    if (!user) {
      signInAsDemo(newRole);
      return;
    }
    const updated: UserProfile = {
      ...user,
      role: newRole,
      displayName: newRole === 'admin' ? 'Dian Pratama, M.Kom. (Admin Kelas)' : 'Luki Giovani (Mahasiswa)',
    };
    setUser(updated);
    offlineStorage.saveUserProfile(updated);
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn('Firebase signout error:', err);
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
        role: user?.role || 'student',
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
