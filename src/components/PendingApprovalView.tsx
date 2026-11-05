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

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setFeedback(null);
      await onRefresh();
      setFeedback('Status berhasil diperiksa ulang. Menunggu persetujuan Super Admin.');
    } catch (e) {
      setFeedback('Gagal memeriksa status. Coba beberapa saat lagi.');
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
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
          SSO Firebase Terhubung
        </span>
      </div>

      {/* Main Approval Card */}
      <div className="w-full max-w-lg mx-auto my-auto bg-white border border-amber-200/90 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Status Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border border-amber-300/80 shadow-xs">
            <Clock className="w-7 h-7 animate-pulse text-amber-700" />
          </div>
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
            Menunggu Persetujuan
          </span>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">
            Akses Menunggu Konfirmasi
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
            Akun Google Anda berhasil diautentikasi lewat Firebase SSO, tetapi email Anda belum terdaftar di whitelist kelas ODP IT BNI 2026.
          </p>
        </div>

        {/* User Account Info Box */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Identitas Akun Masuk (SSO)
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
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Verifikasi Keamanan Akses Kelas</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Permintaan akses Anda telah diteruskan ke <strong>Menu Setting Super Admin</strong>. Setelah Super Admin menyetujui akun Anda, silakan klik tombol <strong>Periksa Status Ulang</strong> di bawah untuk langsung membuka kelas.
          </p>
        </div>

        {feedback && (
          <div className="p-2.5 rounded-xl bg-slate-100 text-[11px] text-slate-700 text-center font-medium">
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Memeriksa Persetujuan...' : 'Periksa Status Ulang'}</span>
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
