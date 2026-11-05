import React, { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useClassData } from '../context/ClassDataContext';

/** Shown on member-management screens when the roster could not be loaded from the role API. */
export const MembersErrorBanner: React.FC = () => {
  const { membersError, reloadMembers } = useClassData();
  const [retrying, setRetrying] = useState(false);

  if (!membersError) return null;

  return (
    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="font-bold block">Daftar anggota gagal dimuat dari server</span>
        <span className="break-words">{membersError}</span>
      </div>
      <button
        onClick={async () => {
          setRetrying(true);
          await reloadMembers();
          setRetrying(false);
        }}
        disabled={retrying}
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-rose-200 font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
        Coba lagi
      </button>
    </div>
  );
};
