import React, { useState } from 'react';
import { Calendar, Lock, CheckCircle2, AlertCircle, Layers, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClassData } from '../context/ClassDataContext';
import { ASSET_IMAGES } from '../lib/seedData';
import { AdminEmailLogin } from './AdminEmailLogin';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, authError, clearAuthError, isOnline } = useAuth();
  const { schedules, classMembers } = useClassData();
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    try {
      await signInWithGoogle();
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-gradient-to-br from-amber-50/60 via-slate-50 to-emerald-50/40 text-slate-900 flex flex-col justify-between">
      {/* Main Login Viewport */}
      <main className="flex-1 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Left Column: Visual Brand Card */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-3xl border border-amber-200 bg-white shadow-xl overflow-hidden relative">
              <div className="h-44 sm:h-52 w-full relative overflow-hidden bg-slate-900">
                <img
                  src={ASSET_IMAGES.campusHeroBanner}
                  alt="BNI Corporate University"
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300 bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-xs">
                    Officer Development Program IT
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black mt-2 tracking-tight text-white">
                    Sistem Terpadu Manajemen Kelas & Jadwal Divisi
                  </h1>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Platform resmi pelatihan Trainee ODP IT BNI Corporate University. Mengelola agenda materi dari setiap divisi teknologi, pembicara (Dept Head & Team Leader), ruangan kelas Graha Sudirman & BNI Corpu, hingga sinkronisasi otomatis Google Calendar.
                </p>

                {/* Key Live Database Metrics */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                    <span className="text-xl font-mono font-extrabold text-amber-950 block">
                      {schedules.length}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Sesi Modul</span>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                    <span className="text-xl font-mono font-extrabold text-emerald-950 block">
                      {classMembers.length}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Trainee Aktif</span>
                  </div>

                  <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-center">
                    <span className="text-xl font-mono font-extrabold text-slate-900 block">
                      100%
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Kehadiran</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Firebase Auth SSO
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-amber-800">
                    <Calendar className="w-3.5 h-3.5" /> Google Calendar & .ICS
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-slate-700">
                    <Layers className="w-3.5 h-3.5" /> Offline Storage
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card (shown first on phones) */}
          <div className="lg:col-span-6 order-first lg:order-none">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl relative space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-extrabold flex items-center justify-center text-sm shadow-xs ring-2 ring-amber-400/30 tracking-wider shrink-0">
                  BNI
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight block">
                    ODP IT BNI Class Hub
                  </span>
                  <p className="text-[11px] text-slate-500">Corporate University · Management Class</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Portal Masuk Resmi</span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Masuk ke UniClass Hub
                </h2>
                <p className="text-xs text-slate-500">
                  Gunakan akun Google yang terdaftar untuk masuk. Hak akses Anda ditentukan otomatis berdasarkan email.
                </p>
              </div>

              {!isOnline && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>Perangkat sedang offline. Sambungkan ke internet untuk masuk.</span>
                </div>
              )}

              {authError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="flex-1">{authError}</span>
                  <button
                    onClick={clearAuthError}
                    className="text-rose-500 hover:text-rose-700 font-bold shrink-0"
                    aria-label="Tutup pesan"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Google Sign-In via Firebase Auth */}
              <div className="space-y-3">
                <button
                  onClick={handleGoogleLogin}
                  disabled={loadingGoogle || !isOnline}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-slate-950 hover:bg-slate-900 active:scale-[0.99] text-white rounded-2xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 cursor-pointer"
                >
                  {loadingGoogle ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                  )}
                  <span>{loadingGoogle ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                </button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-white text-slate-400 font-bold uppercase tracking-wider text-[10px]">atau</span>
                  </div>
                </div>

                {/* Email & password, admin accounts only */}
                <AdminEmailLogin />
              </div>

              {/* Security info footer */}
              <div className="pt-2 text-[10px] text-slate-500 text-center leading-relaxed">
                Sesi masuk diamankan oleh Firebase Authentication dan tetap aktif di perangkat ini sampai Anda keluar.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="w-full py-4 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-200 bg-white/70 text-center text-[11px] sm:text-xs text-slate-500">
        © 2026 PT Bank Negara Indonesia (Persero) Tbk · BNI Corporate University · ODP IT Management Class
      </footer>
    </div>
  );
};
