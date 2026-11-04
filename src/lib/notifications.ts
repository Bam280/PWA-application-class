export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: 'urgent' | 'important' | 'normal' | 'reminder';
  timestamp: string;
  read: boolean;
}

class NotificationService {
  private notifications: InAppNotification[] = [];
  private listeners: Array<(items: InAppNotification[]) => void> = [];

  constructor() {
    this.notifications = [
      {
        id: 'notif-1',
        title: 'Perubahan Ruang UTS Mobile Dev',
        body: 'Lab 202 dipindahkan ke Ruang Auditorium Lt. 4.',
        type: 'urgent',
        timestamp: '10 menit yang lalu',
        read: false,
      },
      {
        id: 'notif-2',
        title: 'Pengingat Deadline Tugas 2',
        body: 'Pengumpulan Source Code Offline Sync besok 23:59 WIB.',
        type: 'reminder',
        timestamp: '1 jam yang lalu',
        read: false,
      },
    ];
  }

  public async requestPushPermission(): Promise<NotificationPermission> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        return perm;
      } catch (e) {
        console.warn('Error requesting notification permission', e);
      }
    }
    return 'default';
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  }

  public playAudioChime() {
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      }
    } catch {
      // Audio autoplay policy safe ignore
    }
  }

  public dispatchNotification(title: string, body: string, type: 'urgent' | 'important' | 'normal' | 'reminder' = 'normal') {
    const newNotif: InAppNotification = {
      id: `notif-${Date.now()}`,
      title,
      body,
      type,
      timestamp: 'Baru saja',
      read: false,
    };

    this.notifications.unshift(newNotif);
    this.notifyListeners();
    this.playAudioChime();

    // Trigger system browser notification if allowed
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`UniClass Hub: ${title}`, {
          body,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('Web notification dispatch error:', err);
      }
    }
  }

  public getNotifications(): InAppNotification[] {
    return [...this.notifications];
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map(n => (n.id === id ? { ...n, read: true } : n));
    this.notifyListeners();
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.notifyListeners();
  }

  public subscribe(cb: (items: InAppNotification[]) => void) {
    this.listeners.push(cb);
    cb(this.notifications);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.notifications);
    }
  }
}

export const notificationService = new NotificationService();
