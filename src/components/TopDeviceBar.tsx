import React, { useState } from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  Wifi,
  WifiOff,
  Bell,
  User,
  Crown,
  ShieldCheck,
  GraduationCap,
  ChevronDown,
  Database,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { DeviceViewMode, UserRole, ROLE_DEFINITIONS } from '../types';
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
  const { user, role, switchRole, signOut, isOnline, toggleSimulatedOffline } = useAuth();
  const { dbConfig } = useClassData();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const currentRoleInfo = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.class_member;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 px-4 py-2.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-3">
          <div className="px-2 py-1 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-xs shadow-xs ring-2 ring-amber-400/40 tracking-wider">
            BNI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 whitespace-nowrap">
                ODP IT BNI Class Hub
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-400">·</span>
              <span className="hidden sm:inline-block text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Corpu Management Class
              </span>
            </div>
          </div>
        </div>

        {/* Production Navigation Mode: Tampilan Kelas vs Portal Admin (Khusus Admin & Super Admin) */}
        {(role === 'super_admin' || role === 'class_admin') && (
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => onViewModeChange('mobile-ios')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode !== 'portal-web'
                  ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Aplikasi Sesi Kelas & Jadwal Trainee ODP"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Aplikasi Kelas</span>
            </button>

            <button
              onClick={() => onViewModeChange('portal-web')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'portal-web'
                  ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Portal Manajemen Admin"
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Portal Admin</span>
            </button>
          </div>
        )}

        {/* Action Controls & Role/Status Zone */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline Mode Toggle Button */}
          <button
            onClick={toggleSimulatedOffline}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
            }`}
            title={isOnline ? 'Koneksi Online. Klik untuk simulasi Offline.' : 'Mode Offline Aktif. Klik untuk Online.'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </button>

          {/* Database Provider Status Badge */}
          <button
            onClick={() => onViewModeChange('portal-web')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
            title="Sumber Database Aktif. Klik untuk pengaturan di Portal Admin."
          >
            <Database className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[11px] font-mono">
              DB: {dbConfig.provider === 'firestore' ? 'Firestore' : dbConfig.provider === 'custom_api' ? 'API Pribadi' : 'Lokal'}
            </span>
          </button>

          {/* Role Switcher Menu (3 Roles) */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-900 transition-colors shadow-xs"
              title="Ganti Peran: Super Admin / Admin Kelas / Member Kelas"
            >
              {role === 'super_admin' ? (
                <Crown className="w-3.5 h-3.5 text-amber-600" />
              ) : role === 'class_admin' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-yellow-600" />
              ) : (
                <GraduationCap className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span className="hidden sm:inline">{currentRoleInfo.label}</span>
              <ChevronDown className="w-3 h-3 text-amber-700 opacity-70" />
            </button>

            {/* Dropdown Menu for Roles */}
            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pilih Role Pengguna</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Uji hak akses sistem secara instan</p>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      switchRole('super_admin');
                      setShowRoleMenu(false);
                      onViewModeChange('portal-web');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                      role === 'super_admin'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Crown className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <div className="font-bold">Super Admin</div>
                      <div className="text-[10px] text-slate-500">Full manage menu setting & role kelas</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      switchRole('class_admin');
                      setShowRoleMenu(false);
                      onViewModeChange('portal-web');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                      role === 'class_admin'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" />
                    <div>
                      <div className="font-bold">Admin Kelas (Ketua Kelas)</div>
                      <div className="text-[10px] text-slate-500">Kirim, ubah, edit jadwal, berita, & pengingat</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      switchRole('class_member');
                      setShowRoleMenu(false);
                      onViewModeChange('mobile-ios');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                      role === 'class_member'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 shrink-0 mt-0.5 text-slate-600" />
                    <div>
                      <div className="font-bold">Member Kelas (Mahasiswa)</div>
                      <div className="text-[10px] text-slate-500">Hanya melihat beranda, jadwal, berita, & tugas</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Push Notification Trigger */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
            title="Buka Notifikasi Push"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-slate-950 flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile / SSO Button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 transition-colors"
            title="Kelola Profil & Sesi SSO"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="w-5 h-5 rounded-full object-cover border border-amber-300" />
            ) : (
              <User className="w-4 h-4 text-slate-400" />
            )}
            <span className="hidden sm:inline max-w-[100px] truncate font-semibold">
              {user ? user.displayName.split(' ')[0] : 'Profil'}
            </span>
          </button>

          {/* Sign Out Button */}
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-colors shadow-2xs"
            title="Keluar dari akun dan kembali ke halaman login"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
