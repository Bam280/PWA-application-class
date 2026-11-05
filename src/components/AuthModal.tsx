import React from 'react';
import { X, ShieldCheck, GraduationCap, Crown, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFINITIONS } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, signInWithGoogle, signInAsDemo, signOut, role } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6 pt-2">
          <div className="inline-flex p-3 bg-amber-100 text-amber-800 rounded-2xl border border-amber-300 mb-3 shadow-xs">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Portal SSO UniClass Hub</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Sistem Masuk Tunggal (SSO) Terintegrasi Akun Google Kampus & Firebase Auth
          </p>
        </div>

        {user ? (
          <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-12 h-12 rounded-xl object-cover border border-amber-300 shadow-xs"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 truncate">{user.displayName}</h3>
                </div>
                <div className="mt-0.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      role === 'super_admin'
                        ? 'bg-amber-200 text-amber-950 border-amber-300'
                        : role === 'class_admin'
                        ? 'bg-yellow-100 text-yellow-950 border-yellow-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {ROLE_DEFINITIONS[role]?.label || role}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-1">{user.email}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-200 flex items-center justify-between">
              <span className="text-xs text-emerald-700 flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4" />
                Sesi SSO Aktif (Firebase Auth)
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  onClose();
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline"
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
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-xs active:scale-[0.98]"
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
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                Uji Peran Sistem (Demo Personas)
              </span>
            </div>
          </div>

          {/* Quick SSO 3-Role Demo Buttons */}
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => {
                signInAsDemo('super_admin');
                onClose();
              }}
              className="p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-left transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Crown className="w-4 h-4 text-amber-700" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Super Admin</span>
                  <p className="text-[10px] text-slate-500">Dian Pratama (Full manage menu setting & role)</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded">Pilih</span>
            </button>

            <button
              onClick={() => {
                signInAsDemo('class_admin');
                onClose();
              }}
              className="p-3 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded-xl text-left transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-yellow-700" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Admin Kelas (Ketua Kelas)</span>
                  <p className="text-[10px] text-slate-500">Ahmad Faiz Ramadhan (Kirim & edit jadwal, berita)</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-yellow-900 bg-yellow-200/70 px-2 py-0.5 rounded">Pilih</span>
            </button>

            <button
              onClick={() => {
                signInAsDemo('class_member');
                onClose();
              }}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-slate-600" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Member Kelas (Mahasiswa)</span>
                  <p className="text-[10px] text-slate-500">Luki Giovani (Hanya membaca jadwal, berita, & tugas)</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">Pilih</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 text-center mt-5 leading-normal">
          Autentikasi Firebase Auth terisolasi penuh dari basis data / REST API pribadi.
        </p>
      </div>
    </div>
  );
};
