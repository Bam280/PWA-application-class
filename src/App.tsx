import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClassDataProvider } from './context/ClassDataContext';
import { TopDeviceBar } from './components/TopDeviceBar';
import { StudentMobileApp } from './components/StudentMobileApp';
import { AdminPortal } from './components/AdminPortal';
import { AuthModal } from './components/AuthModal';
import { NotificationModal } from './components/NotificationModal';
import { LoginPage } from './components/LoginPage';
import { DeviceViewMode } from './types';
import { notificationService, InAppNotification } from './lib/notifications';
import { testFirebaseConnection } from './lib/firebase';

const MainApp: React.FC = () => {
  const { user, role, loading } = useAuth();
  // Default to Web Portal for super_admin and class_admin, or Class App view for class_member
  const [viewMode, setViewMode] = useState<DeviceViewMode>(() =>
    role === 'class_member' ? 'mobile-ios' : 'portal-web'
  );
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>(() =>
    notificationService.getNotifications()
  );

  // Sync role changes to sensible default view
  useEffect(() => {
    if (role === 'class_member' && viewMode === 'portal-web') {
      setViewMode('mobile-ios');
    }
  }, [role, viewMode]);

  // Subscribe to real-time notification engine
  useEffect(() => {
    const unsub = notificationService.subscribe((list) => {
      setNotifications([...list]);
    });
    // Test Firebase connection on boot
    testFirebaseConnection();
    return () => unsub();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-600">Menghubungkan Sesi ODP IT BNI...</span>
        </div>
      </div>
    );
  }

  // Initial access must be gated by the production login page connected to Firebase Auth
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col">
      {/* Top Application Navbar */}
      <TopDeviceBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenNotifications={() => setIsNotifOpen(true)}
        notifications={notifications}
      />

      {/* Main Content Area - Full application layout without simulated phone frames */}
      <main className="flex-1 flex flex-col w-full p-2 sm:p-4 lg:p-6">
        {viewMode === 'portal-web' ? (
          <AdminPortal />
        ) : (
          <StudentMobileApp viewMode={viewMode} />
        )}
      </main>

      {/* Interactive Modals */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
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
