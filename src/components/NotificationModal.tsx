import React from 'react';
import { Bell, Check, X, ShieldAlert, Clock, AlertTriangle, Info } from 'lucide-react';
import { notificationService, InAppNotification } from '../lib/notifications';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: InAppNotification[];
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose, notifications }) => {
  if (!isOpen) return null;

  const handleTestPush = async () => {
    const perm = await notificationService.requestPushPermission();
    notificationService.dispatchNotification(
      'Uji Coba Push Notifikasi',
      'Sistem notifikasi real-time UniClass Hub aktif dan tersinkronisasi!',
      'normal'
    );
  };

  const getTypeIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'urgent':
        return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'important':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'reminder':
        return <Clock className="w-4 h-4 text-indigo-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Pusat Notifikasi</h3>
              <p className="text-xs text-slate-400">Pemberitahuan & Pengingat Real-Time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <button
            onClick={() => notificationService.markAllAsRead()}
            className="text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 font-medium transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Tandai semua dibaca
          </button>
          <button
            onClick={handleTestPush}
            className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-medium rounded-md border border-indigo-500/30 transition-colors"
          >
            Uji Push Notif
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-2.5 divide-y divide-slate-800/40">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Belum ada notifikasi baru
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => notificationService.markAsRead(item.id)}
                className={`pt-2.5 first:pt-0 p-2.5 rounded-xl transition-all cursor-pointer ${
                  item.read ? 'bg-slate-900/40 opacity-70' : 'bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-200 truncate">{item.title}</h4>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">{item.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
