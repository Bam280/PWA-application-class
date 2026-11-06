import React, { useState } from 'react';
import {
  ShieldAlert,
  Clock,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Lock,
  Mail,
  User,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile } from '../types';

interface PendingApprovalViewProps {
  user: UserProfile;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  user,
  onRefresh,
  onSignOut,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Background auto-check every 5 seconds so when Super Admin approves, the screen unlocks automatically
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await onRefresh();
      } catch {
        // silent check
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setFeedback(null);
      await onRefresh();
      setFeedback('Status akun sedang diverifikasi ulang...');
    } catch {
      setFeedback('Belum disetujui oleh Super Admin. Mohon tunggu beberapa saat.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-amber-50/70 via-slate-50 to-orange-50/50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Brand Bar */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-extrabold flex items-center justify-center text-xs shadow-xs tracking-wider">
            BNI
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900 tracking-tight">ODP IT BNI 2026</h1>
            <p className="text-[10px] text-slate-500">Corporate University · Management Class</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
          SSO Google Terhubung
        </span>
      </div>

      {/* Main Approval Modal Card */}
      <div className="w-full max-w-md mx-auto my-auto bg-white border border-amber-300 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Status Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border-2 border-amber-300 shadow-sm relative">
            <Clock className="w-8 h-8 animate-pulse text-amber-700" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
            </span>
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
            Menunggu Persetujuan Akun
          </div>

          {/* Exact required wording */}
          <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
            Akun anda belum terdaftar di dalam kelas, mohon tunggu sampai akun anda disetujui.
          </h2>

          <p className="text-xs text-slate-600 leading-relaxed">
            Permintaan akses akun Google Anda telah dikirimkan ke <strong>Super Admin</strong>. Halaman ini akan otomatis membuka akses kelas saat akun Anda telah disetujui.
          </p>
        </div>

        {/* User Account Info Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Identitas Akun Google SSO
          </div>
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-11 h-11 rounded-full object-cover border-2 border-amber-400 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-sm shrink-0">
                {user.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold text-slate-900 truncate">{user.displayName}</h3>
              <p className="text-[11px] text-slate-600 truncate flex items-center gap-1 font-mono mt-0.5">
                <Mail className="w-3 h-3 text-slate-400" />
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Instructions Info */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900 block text-xs">Pemberitahuan Super Admin:</span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Super Admin dapat memberikan akses melalui menu <strong>Pengaturan &rarr; Konfirmasi User SSO</strong> di aplikasi.
            </p>
          </div>
        </div>

        {feedback && (
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-[11px] text-center font-medium">
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Memeriksa Persetujuan...' : 'Periksa Status Persetujuan'}</span>
          </button>

          <button
            onClick={onSignOut}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Keluar / Ganti Akun Google</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center text-[11px] text-slate-400 py-2">
        @2026 oleh LebahGantenk
      </footer>
    </div>
  );
};
