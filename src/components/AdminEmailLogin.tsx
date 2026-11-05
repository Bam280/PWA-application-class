import React, { useState } from 'react';
import { Mail, Eye, EyeOff, ShieldCheck, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Email & password sign-in for admins. Accounts are created by a super admin in Firebase
 * (self sign-up is not offered); the role still comes from the role API, and non-admins
 * who sign in this way are signed out again by AuthContext.
 */
export const AdminEmailLogin: React.FC = () => {
  const { signInWithEmail, sendPasswordReset, clearAuthError, isOnline } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetNotice, setResetNotice] = useState<{ ok: boolean; message: string } | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          clearAuthError();
          setOpen(true);
        }}
        className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-2xl font-bold text-sm transition-colors"
      >
        <Mail className="w-4 h-4 text-slate-600" />
        <span>Masuk dengan Email</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
          Admin
        </span>
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetNotice(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    clearAuthError();
    setSendingReset(true);
    try {
      setResetNotice(await sendPasswordReset(email));
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-2xl border border-slate-200 bg-slate-50/70">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          Login Admin
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPassword('');
            setResetNotice(null);
            clearAuthError();
          }}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold text-slate-600">Email</span>
        <input
          type="email"
          required
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@perusahaan.co.id"
          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-semibold text-slate-600">Password</span>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </label>

      {resetNotice && (
        <div
          className={`p-3 rounded-xl text-[11px] flex items-start gap-2 border ${
            resetNotice.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {resetNotice.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{resetNotice.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !isOnline}
        className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
      >
        {submitting && <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />}
        {submitting ? 'Memeriksa...' : 'Masuk sebagai Admin'}
      </button>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Akun dibuat oleh Super Admin.</span>
        <button
          type="button"
          onClick={handleReset}
          disabled={sendingReset || !isOnline}
          className="font-bold text-amber-800 hover:underline disabled:opacity-60"
        >
          {sendingReset ? 'Mengirim...' : 'Lupa password?'}
        </button>
      </div>
    </form>
  );
};
