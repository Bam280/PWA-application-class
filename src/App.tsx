import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClassDataProvider } from './context/ClassDataContext';
import { StudentMobileApp } from './components/StudentMobileApp';
import { AdminPortal } from './components/AdminPortal';
import { NotificationModal } from './components/NotificationModal';
import { LoginPage } from './components/LoginPage';
import { PendingApprovalView } from './components/PendingApprovalView';
import { notificationService, InAppNotification } from './lib/notifications';
import { testFirebaseConnection } from './lib/firebase';
import { useMediaQuery } from './lib/useMediaQuery';

export type AppView = 'portal' | 'app';

/** Signed in with Firebase, but the role API could not confirm a role (and nothing is cached). */
const AccessErrorScreen: React.FC = () => {
  const { firebaseUser, accessError, refreshAccess, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-slate-900">Hak akses belum dapat dimuat</h1>
            <p className="text-xs text-slate-500 truncate">{firebaseUser?.email}</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed break-words">{accessError}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button
            onClick={async () => {
              setRetrying(true);
              await refreshAccess();
              setRetrying(false);
            }}
            disabled={retrying}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            Coba lagi
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
};

const MainApp: React.FC = () => {
  const { user, firebaseUser, role, loading, accessError, refreshAccess, signOut } = useAuth();
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

  // Signed in with Firebase but the role API could not be reached
  if (!user && firebaseUser && accessError) {
    return <AccessErrorScreen />;
  }

  // Access is gated by the login page connected to Firebase Auth
  if (!user) {
    return <LoginPage />;
  }

  // If user signed in with SSO Google but is waiting for Super Admin confirmation:
  if (user.status === 'pending') {
    return (
      <PendingApprovalView
        user={user}
        onRefresh={refreshAccess}
        onSignOut={signOut}
      />
    );
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
