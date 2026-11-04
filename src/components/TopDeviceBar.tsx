import React from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  Wifi,
  WifiOff,
  Bell,
  User,
  Shield,
  GraduationCap,
  Calendar,
  Database,
} from 'lucide-react';
import { DeviceViewMode } from '../types';
import { useAuth } from '../context/AuthContext';
import { useClassData } from '../context/ClassDataContext';
import { InAppNotification } from '../lib/notifications';

interface TopDeviceBarProps {
  viewMode: DeviceViewMode;
  onViewModeChange: (mode: DeviceViewMode) => void;
  onOpenAuth: () => void;
  onOpenNotifications: () => void;
  notifications: InAppNotification[];
}

export const TopDeviceBar: React.FC<TopDeviceBarProps> = ({
  viewMode,
  onViewModeChange,
  onOpenAuth,
  onOpenNotifications,
  notifications,
}) => {
  const { user, role, switchRole, isOnline, toggleSimulatedOffline } = useAuth();
  const { dbConfig } = useClassData();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-200 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shadow-indigo-500/20">
            UC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">UniClass Hub</span>
              <span className="hidden sm:inline-block text-[11px] text-slate-400">·</span>
              <span className="hidden sm:inline-block text-[11px] text-slate-400">Portal Akademik Terpadu</span>
            </div>
          </div>
        </div>

        {/* Device Viewport Mode Switcher */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 text-xs">
          <button
            onClick={() => onViewModeChange('mobile-ios')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'mobile-ios'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tampilan Aplikasi iOS iPhone"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">iOS (iPhone)</span>
            <span className="md:hidden">iOS</span>
          </button>

          <button
            onClick={() => onViewModeChange('mobile-android')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'mobile-android'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tampilan Aplikasi Android"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Android</span>
            <span className="md:hidden">Android</span>
          </button>

          <button
            onClick={() => onViewModeChange('portal-web')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'portal-web'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tampilan Portal Web Desktop Admin"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Portal Web Admin</span>
            <span className="md:hidden">Web</span>
          </button>
        </div>

        {/* Action Controls & Role/Status Zone */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline Mode Toggle Button */}
          <button
            onClick={toggleSimulatedOffline}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
            }`}
            title={isOnline ? 'Koneksi Online. Klik untuk simulasi Offline.' : 'Mode Offline Aktif. Klik untuk Online.'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </button>

          {/* Database Provider Status Badge */}
          <button
            onClick={() => onViewModeChange('portal-web')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition-colors"
            title="Sumber Database Aktif. Klik untuk pengaturan di Portal Admin."
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-mono">
              DB: {dbConfig.provider === 'firestore' ? 'Firestore' : dbConfig.provider === 'custom_api' ? 'API Pribadi' : 'Lokal'}
            </span>
          </button>

          {/* Quick Role Switcher Button */}
          <button
            onClick={() => switchRole(role === 'admin' ? 'student' : 'admin')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 transition-colors"
            title="Klik untuk beralih antara peran Mahasiswa dan Dosen/Admin"
          >
            {role === 'admin' ? (
              <>
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Peran: Admin</span>
              </>
            ) : (
              <>
                <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Peran: Mahasiswa</span>
              </>
            )}
          </button>

          {/* Push Notification Trigger */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white transition-colors"
            title="Buka Notifikasi Push"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile / SSO Button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/50 text-xs text-slate-200 transition-colors"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
            <span className="hidden sm:inline max-w-[100px] truncate font-medium">
              {user ? user.displayName.split(' ')[0] : 'Masuk SSO'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
