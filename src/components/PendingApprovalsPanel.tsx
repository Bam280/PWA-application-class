import React, { useState } from 'react';
import {
  UserCheck,
  UserX,
  Clock,
  ShieldCheck,
  GraduationCap,
  Mail,
  Check,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { PendingUserApproval, UserRole, ROLE_DEFINITIONS } from '../types';

interface PendingApprovalsPanelProps {
  pendingApprovals: PendingUserApproval[];
  onApprove: (id: string, role: UserRole, nim: string) => Promise<boolean>;
  onReject: (id: string) => Promise<boolean>;
}

export const PendingApprovalsPanel: React.FC<PendingApprovalsPanelProps> = ({
  pendingApprovals,
  onApprove,
  onReject,
}) => {
  // Store form state per pending approval id: { [id]: { role: UserRole, nim: string } }
  const [formData, setFormData] = useState<Record<string, { role: UserRole; nim: string }>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const getRole = (id: string): UserRole => formData[id]?.role || 'class_member';
  const getNim = (id: string, email: string): string => {
    if (formData[id]?.nim !== undefined) return formData[id].nim;
    // Suggest default NIM based on email or random sequence
    return `ODP-IT-2026-${Math.floor(100 + Math.random() * 900)}`;
  };

  const handleRoleChange = (id: string, role: UserRole) => {
    setFormData(prev => ({
      ...prev,
      [id]: { role, nim: prev[id]?.nim || '' },
    }));
  };

  const handleNimChange = (id: string, nim: string) => {
    setFormData(prev => ({
      ...prev,
      [id]: { role: prev[id]?.role || 'class_member', nim },
    }));
  };

  const handleApprove = async (p: PendingUserApproval) => {
    try {
      setProcessingId(p.id);
      const role = getRole(p.id);
      const nim = getNim(p.id, p.email);
      await onApprove(p.id, role, nim);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setProcessingId(id);
      await onReject(id);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Explainer Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-950 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
            Khusus Super Admin
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-600 font-semibold">Otentikasi & Whitelist SSO Google</span>
        </div>
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-amber-700" />
          <span>Konfirmasi Akses User SSO Baru</span>
          {pendingApprovals.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
              {pendingApprovals.length} Menunggu
            </span>
          )}
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          Jika ada mahasiswa atau anggota yang login menggunakan akun Google SSO namun emailnya belum terdaftar sebelumnya di database, mereka akan tertahan di layar menunggu konfirmasi. Super Admin dapat menyetujui, menentukan role (Admin Kelas atau Member Kelas), dan menetapkan NIM/NIP peserta di bawah ini.
        </p>
      </div>

      {/* Pending List or Empty State */}
      {pendingApprovals.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
            <Check className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">
            Tidak Ada Permintaan Akses yang Menunggu
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Semua user yang login via Google SSO telah terdaftar di database kelas. Mahasiswa yang ditambahkan melalui menu <strong>Daftar Mahasiswa</strong> akan otomatis langsung terhubung saat login SSO.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingApprovals.map((p) => {
            const isProcessing = processingId === p.id;
            const currentRole = getRole(p.id);
            const currentNim = getNim(p.id, p.email);

            return (
              <div
                key={p.id}
                className="p-5 sm:p-6 rounded-3xl bg-white border border-amber-300 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                {/* User Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    {p.avatarUrl ? (
                      <img
                        src={p.avatarUrl}
                        alt={p.displayName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-amber-200 text-amber-950 font-bold flex items-center justify-center text-sm shrink-0">
                        {p.displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">{p.displayName}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          SSO Baru
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-mono mt-0.5 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {p.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {new Date(p.requestedAt).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Configuration form for Super Admin */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Select Role */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Tetapkan Role Akses
                    </label>
                    <select
                      value={currentRole}
                      onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="class_member">Member Kelas (Mahasiswa / Trainee ODP)</option>
                      <option value="class_admin">Admin Kelas (Ketua Angkatan / PJ Jadwal)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {ROLE_DEFINITIONS[currentRole]?.description || ''}
                    </p>
                  </div>

                  {/* Input NIM / NIP */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      NIM / NIP Trainee BNI
                    </label>
                    <input
                      type="text"
                      value={currentNim}
                      onChange={(e) => handleNimChange(p.id, e.target.value)}
                      placeholder="Contoh: NIP: ODP-IT-2026-009"
                      className="w-full px-3 py-2 text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Nomor identitas unik peserta pelatihan di BNI Corporate University.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => handleReject(p.id)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Tolak</span>
                  </button>

                  <button
                    onClick={() => handleApprove(p)}
                    disabled={isProcessing}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isProcessing ? 'Memproses...' : 'Setujui & Berikan Akses'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
