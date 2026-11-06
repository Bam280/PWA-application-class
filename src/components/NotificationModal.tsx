import React, { useState } from 'react';
import { Bell, BellRing, Check, X, ShieldAlert, Clock, AlertTriangle, Info } from 'lucide-react';
import {
  notificationService,
  InAppNotification,
  DeviceNotificationState,
  formatNotificationTime,
} from '../lib/notifications';
import { DEVICE_STATE_HELP } from './PushPermissionPrompt';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: InAppNotification[];
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose, notifications }) => {
  const [deviceState, setDeviceState] = useState<DeviceNotificationState>(() => notificationService.getDeviceState());

  if (!isOpen) return null;

  const enableOrTest = async () => {
    if (deviceState === 'granted') {
      await notificationService.showOnDevice('Uji notifikasi', 'Notifikasi di perangkat ini berfungsi.');
    } else {
      setDeviceState(await notificationService.enableDeviceNotifications());
    }
  };

  const getTypeIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'urgent':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      case 'important':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'reminder':
        return <Clock className="w-4 h-4 text-amber-600" />;
      default:
        return <Info className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Pusat Notifikasi</h3>
              <p className="text-xs text-slate-500">Pemberitahuan & Pengingat Real-Time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <button
            onClick={() => notificationService.markAllAsRead()}
            className="text-slate-600 hover:text-amber-700 flex items-center gap-1.5 font-bold transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Tandai semua dibaca
          </button>
        </div>

        {/* Device notifications */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-start justify-between gap-3 text-xs">
          <p className="flex items-start gap-2 text-slate-600 leading-relaxed">
            <BellRing className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <span>{DEVICE_STATE_HELP[deviceState]}</span>
          </p>
          {(deviceState === 'default' || deviceState === 'granted') && (
            <button
              onClick={enableOrTest}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors shadow-2xs whitespace-nowrap"
            >
              {deviceState === 'granted' ? 'Uji' : 'Aktifkan'}
            </button>
          )}
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-2.5 divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Belum ada notifikasi baru
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => notificationService.markAsRead(item.id)}
                className={`pt-2.5 first:pt-0 p-3 rounded-2xl transition-all cursor-pointer ${
                  item.read ? 'bg-slate-50/70 opacity-70' : 'bg-amber-50/50 hover:bg-amber-50 border border-amber-200/80 shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-white border border-slate-200">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{item.title}</h4>
                      <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">{formatNotificationTime(item.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">{item.body}</p>
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
