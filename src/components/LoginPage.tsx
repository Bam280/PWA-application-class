import React, { useState } from 'react';
import {
  Crown,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Database,
  Calendar,
  Bell,
  Wifi,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClassData } from '../context/ClassDataContext';
import { ASSET_IMAGES } from '../lib/seedData';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, signInAsDemo, isOnline } = useAuth();
  const { dbConfig, schedules, classMembers } = useClassData();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoadingGoogle(true);
      setErrorMsg(null);
      await signInWithGoogle();
    } catch (err) {
      console.error('Google SSO login error:', err);
      setErrorMsg('Gagal masuk dengan Google SSO. Anda dapat menggunakan pilihan akses cepat role di bawah.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleSelectRole = (role: UserRole) => {
    setErrorMsg(null);
    signInAsDemo(role);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-amber-50/60 via-slate-50 to-emerald-50/40 text-slate-900 flex flex-col justify-between">
      {/* Top Brand Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-extrabold flex items-center justify-center text-sm shadow-xs ring-2 ring-amber-400/30 tracking-wider">
            BNI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                ODP IT BNI Class Hub
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                Production
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Corporate University · Management Class</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium">
            <Database className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">DB:</span>
            <span className="font-mono font-bold text-amber-900">
              {dbConfig.provider === 'firestore' ? 'Cloud Firestore' : 'API Pribadi'}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isOnline
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <Wifi className="w-3 h-3" />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Main Login Viewport */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
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

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl relative space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Portal Masuk Resmi</span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Masuk ke UniClass Hub
                </h2>
                <p className="text-xs text-slate-500">
                  Gunakan Single Sign-On (SSO) Akun Google atau pilih kredensial peran di bawah untuk akses langsung.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Primary: Real Google SSO with Firebase Auth */}
              <div className="space-y-3">
                <button
                  onClick={handleGoogleLogin}
                  disabled={loadingGoogle}
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
                  <span>{loadingGoogle ? 'Menghubungkan Firebase Auth...' : 'Masuk dengan Google SSO (Firebase Auth)'}</span>
                </button>
              </div>

              {/* Separator */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    Atau Masuk Cepat Sesuai Hak Akses
                  </span>
                </div>
              </div>

              {/* Quick Persona Logins for All 3 Roles */}
              <div className="space-y-2.5">
                {/* Super Admin */}
                <button
                  onClick={() => handleSelectRole('super_admin')}
                  className="w-full p-3.5 bg-amber-50/80 hover:bg-amber-100 border border-amber-200 rounded-2xl text-left transition-all flex items-center justify-between group shadow-2xs hover:shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 block">Super Admin</span>
                        <span className="text-[9px] font-bold text-amber-950 bg-amber-200 px-1.5 py-0.2 rounded">
                          Full Access
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        julionedna23@gmail.com · Head of IT Learning BNI
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-900 group-hover:translate-x-1 transition-transform">
                    <span>Masuk</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Admin Kelas */}
                <button
                  onClick={() => handleSelectRole('class_admin')}
                  className="w-full p-3.5 bg-yellow-50/70 hover:bg-yellow-100/90 border border-yellow-200 rounded-2xl text-left transition-all flex items-center justify-between group shadow-2xs hover:shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-400 text-slate-950 rounded-xl font-bold">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 block">Admin Kelas</span>
                        <span className="text-[9px] font-bold text-yellow-950 bg-yellow-200 px-1.5 py-0.2 rounded">
                          Ketua Angkatan
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        faiz.ramadhan@bni.co.id · Kelola Jadwal Divisi & Berita
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-yellow-900 group-hover:translate-x-1 transition-transform">
                    <span>Masuk</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Member Kelas Trainee */}
                <button
                  onClick={() => handleSelectRole('class_member')}
                  className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-left transition-all flex items-center justify-between group shadow-2xs hover:shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-200 text-slate-700 rounded-xl font-bold">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 block">Member Kelas (Trainee)</span>
                        <span className="text-[9px] font-bold text-slate-700 bg-slate-200 px-1.5 py-0.2 rounded">
                          Peserta ODP
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        luki.giovani@bni.co.id · Jadwal, Materi, & Tugas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-800 group-hover:translate-x-1 transition-transform">
                    <span>Masuk</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>

              {/* Security info footer */}
              <div className="pt-2 text-[10px] text-slate-500 text-center leading-relaxed">
                Terkoneksi aman dengan Firebase Authentication & Firestore Database Production. Sesi autentikasi terisolasi dari API eksternal.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="w-full py-4 px-6 border-t border-slate-200 bg-white/70 text-center text-xs text-slate-500">
        © 2026 PT Bank Negara Indonesia (Persero) Tbk · BNI Corporate University · ODP IT Management Class
      </footer>
    </div>
  );
};
