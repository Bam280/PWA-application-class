import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClassDataProvider } from './context/ClassDataContext';
import { TopDeviceBar } from './components/TopDeviceBar';
import { StudentMobileApp } from './components/StudentMobileApp';
import { AdminPortal } from './components/AdminPortal';
import { AuthModal } from './components/AuthModal';
import { NotificationModal } from './components/NotificationModal';
import { DeviceViewMode } from './types';
import { notificationService, InAppNotification } from './lib/notifications';
import { testFirebaseConnection } from './lib/firebase';

const MainApp: React.FC = () => {
  const { role } = useAuth();
  // Default to iOS mobile view for students, or Web Portal for admin
  const [viewMode, setViewMode] = useState<DeviceViewMode>('mobile-ios');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>(() =>
    notificationService.getNotifications()
  );

  // Sync role changes to sensible default view
  useEffect(() => {
    if (role === 'admin' && viewMode !== 'portal-web') {
      setViewMode('portal-web');
    } else if (role === 'student' && viewMode === 'portal-web') {
      setViewMode('mobile-ios');
    }
  }, [role]);

  // Subscribe to real-time notification engine
  useEffect(() => {
    const unsub = notificationService.subscribe((list) => {
      setNotifications([...list]);
    });
    // Test Firebase connection on boot
    testFirebaseConnection();
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Device & Role Navigation Bar */}
      <TopDeviceBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenNotifications={() => setIsNotifOpen(true)}
        notifications={notifications}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4">
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
