import React from 'react';
import { X, ShieldCheck, GraduationCap, Building2, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, signInWithGoogle, signInAsDemo, signOut, role } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6 pt-2">
          <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20 mb-3">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Portal SSO UniClass Hub</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Sistem Masuk Tunggal (SSO) Terintegrasi Akun Google Kampus & Firebase Auth
          </p>
        </div>

        {user ? (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <img
                src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={user.displayName}
                className="w-12 h-12 rounded-xl object-cover border border-slate-700"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-slate-200 truncate">{user.displayName}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                    role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}>
                    {role === 'admin' ? 'Dosen / Admin' : 'Mahasiswa'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                {user.nim && <p className="text-[11px] text-slate-500 font-mono mt-0.5">NIM: {user.nim}</p>}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
              <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4" />
                Sesi SSO Aktif
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  onClose();
                }}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline font-medium"
              >
                Keluar (Sign Out)
              </button>
            </div>
          </div>
        ) : null}

        {/* Real Google SSO Button */}
        <div className="space-y-3">
          <button
            onClick={async () => {
              await signInWithGoogle();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-semibold text-sm transition-all shadow-md active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Masuk dengan Google SSO
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-900 text-slate-500 font-medium">Atau Akses Cepat Peran</span>
            </div>
          </div>

          {/* Quick SSO Role Switches */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                signInAsDemo('student');
                onClose();
              }}
              className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-200">Mahasiswa</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Luki Giovani (S-1 TI)</p>
            </button>

            <button
              onClick={() => {
                signInAsDemo('admin');
                onClose();
              }}
              className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-200">Dosen / Admin</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">LukiGio23@gmail.com</p>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 text-center mt-5 leading-normal">
          Peran Admin mengizinkan publikasi berita, pengingat, dan pemantauan analitik pembacaan mahasiswa.
        </p>
      </div>
    </div>
  );
};
