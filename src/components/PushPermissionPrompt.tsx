import React, { useState } from 'react';
import { BellRing, Share, X } from 'lucide-react';
import { notificationService, DeviceNotificationState } from '../lib/notifications';

const DISMISSED_KEY = 'uniclass_push_prompt_dismissed';

/** What the device-notification control says for each state; shared with the notification center. */
export const DEVICE_STATE_HELP: Record<DeviceNotificationState, string> = {
  granted: 'Notifikasi aktif di perangkat ini.',
  default: 'Dapatkan pemberitahuan di perangkat ini untuk pengumuman, pengingat, dan perubahan jadwal.',
  denied: 'Notifikasi diblokir. Aktifkan lewat pengaturan situs di browser Anda.',
  'ios-needs-install': 'Di iPhone/iPad, ketuk Bagikan lalu "Tambahkan ke Layar Utama", dan buka aplikasi dari ikon tersebut.',
  unsupported: 'Browser ini tidak mendukung notifikasi perangkat.',
};

/** Asks once after sign-in. The permission prompt only opens from a tap, as browsers require. */
export const PushPermissionPrompt: React.FC = () => {
  const [state, setState] = useState<DeviceNotificationState>(() => notificationService.getDeviceState());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed || (state !== 'default' && state !== 'ios-needs-install')) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Prompt just returns on the next visit.
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Aktifkan notifikasi"
      className="fixed z-40 left-3 right-3 bottom-20 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 bg-white border border-amber-300 rounded-2xl shadow-xl p-4 text-xs text-slate-700"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
          {state === 'default' ? <BellRing className="w-4 h-4" /> : <Share className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-bold text-slate-900 text-sm">Aktifkan notifikasi</h3>
          <p className="leading-relaxed">{DEVICE_STATE_HELP[state]}</p>
        </div>
        <button onClick={dismiss} aria-label="Tutup" className="p-1 text-slate-400 hover:text-slate-700 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      {state === 'default' && (
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={dismiss} className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900">
            Nanti
          </button>
          <button
            onClick={async () => setState(await notificationService.enableDeviceNotifications())}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
          >
            Aktifkan
          </button>
        </div>
      )}
    </div>
  );
};
