import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClassDataProvider } from './context/ClassDataContext';
import { StudentMobileApp } from './components/StudentMobileApp';
import { AdminPortal } from './components/AdminPortal';
import { NotificationModal } from './components/NotificationModal';
import { LoginPage } from './components/LoginPage';
import { notificationService, InAppNotification } from './lib/notifications';
import { testFirebaseConnection } from './lib/firebase';
import { useMediaQuery } from './lib/useMediaQuery';

export type AppView = 'portal' | 'app';

const MainApp: React.FC = () => {
  const { user, firebaseUser, role, loading } = useAuth();
  const isAdmin = role === 'super_admin' || role === 'class_admin';
  // Desktop-sized screens get the admin portal; phones and tablets get the class app.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // Explicit choice made by an admin from inside the UI; null = follow the device.
  const [viewOverride, setViewOverride] = useState<AppView | null>(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>(() =>
    notificationService.getNotifications()
  );

  const view: AppView = isAdmin ? viewOverride ?? (isDesktop ? 'portal' : 'app') : 'app';
  const unreadCount = notifications.filter(n => !n.read).length;

  // Reset the manual view choice whenever the signed-in account changes.
  useEffect(() => {
    setViewOverride(null);
  }, [user?.id]);

  // Subscribe to real-time notification engine
  useEffect(() => {
    const unsub = notificationService.subscribe((list) => {
      setNotifications([...list]);
    });
    return () => unsub();
  }, []);

  // Firestore rules reject unauthenticated reads, so only ping once a session exists.
  useEffect(() => {
    if (firebaseUser) testFirebaseConnection();
  }, [firebaseUser?.uid]);

  // Waiting for Firebase Auth to restore a persisted session
  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-600">Memuat sesi...</span>
        </div>
      </div>
    );
  }

  // Access is gated by the login page connected to Firebase Auth
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-dvh bg-slate-100/70 text-slate-900 flex flex-col">
      <main
        className={
          view === 'portal'
            ? 'flex-1 flex flex-col w-full p-3 sm:p-4 lg:p-6'
            : 'flex-1 flex flex-col w-full sm:p-4 lg:p-6'
        }
      >
        {view === 'portal' ? (
          <AdminPortal
            onOpenApp={() => setViewOverride('app')}
            onOpenNotifications={() => setIsNotifOpen(true)}
            unreadCount={unreadCount}
          />
        ) : (
          <StudentMobileApp
            onOpenPortal={isAdmin ? () => setViewOverride('portal') : undefined}
            onOpenNotifications={() => setIsNotifOpen(true)}
            unreadCount={unreadCount}
          />
        )}
      </main>

      <NotificationModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ClassDataProvider>
        <MainApp />
      </ClassDataProvider>
    </AuthProvider>
  );
}
