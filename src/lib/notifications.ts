export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: 'urgent' | 'important' | 'normal' | 'reminder';
  /** ISO time the notification was created; shown relative to now. */
  createdAt: string;
}

/** What this device can do about notifications right now. */
export type DeviceNotificationState =
  | 'granted'
  | 'default' // can ask
  | 'denied' // blocked; only the browser's settings can undo this
  | 'ios-needs-install' // iPhone/iPad: only available after "Add to Home Screen"
  | 'unsupported';

const MAX_STORED = 50;
const storageKey = (accountId: string) => `uniclass_notifications_${accountId}`;

/** "Baru saja", "5 menit lalu", "2 jam lalu", then the date. */
export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const time = new Date(iso);
  if (isNaN(time.getTime())) return '';
  const minutes = Math.floor((now.getTime() - time.getTime()) / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return time.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function isIosWithoutInstall(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

class NotificationService {
  private notifications: InAppNotification[] = [];
  private listeners: Array<(items: InAppNotification[]) => void> = [];
  private accountId: string | null = null;
  private counter = 0;

  /** Each account has its own history on this device; null (signed out) shows nothing. */
  public setAccount(accountId: string | null) {
    if (accountId === this.accountId) return;
    this.accountId = accountId;
    this.notifications = [];
    if (accountId) {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey(accountId)) || '[]');
        // Older versions kept entries after they were read.
        if (Array.isArray(stored)) this.notifications = stored.filter((n: { read?: boolean }) => !n.read);
      } catch {
        // Unreadable history: start empty.
      }
    }
    this.notifyListeners();
  }

  public getDeviceState(): DeviceNotificationState {
    if (typeof window === 'undefined') return 'unsupported';
    if (isIosWithoutInstall()) return 'ios-needs-install';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  /** Must be called from a user action: browsers refuse or ignore the prompt otherwise. */
  public async enableDeviceNotifications(): Promise<DeviceNotificationState> {
    if (this.getDeviceState() !== 'default') return this.getDeviceState();
    try {
      await Notification.requestPermission();
    } catch (e) {
      console.warn('Error requesting notification permission', e);
    }
    const state = this.getDeviceState();
    if (state === 'granted') {
      await this.showOnDevice('Notifikasi aktif', 'Pengumuman, pengingat, dan perubahan jadwal akan muncul di perangkat ini.');
    }
    return state;
  }

  /**
   * Shows a system notification. Goes through the service worker because Android Chrome does not
   * allow `new Notification()`; the constructor is only a fallback for browsers without a worker.
   */
  public async showOnDevice(title: string, body: string): Promise<boolean> {
    if (this.getDeviceState() !== 'granted') return false;
    const options: NotificationOptions = { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: `uc-${Date.now()}` };
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        await registration.showNotification(title, options);
        return true;
      }
      new Notification(title, options);
      return true;
    } catch (err) {
      console.warn('Device notification failed:', err);
      return false;
    }
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

  /**
   * Adds an entry to the notification center. `alertDevice` is for class updates from other people:
   * they also appear as a system notification while the app is in the background. On-screen, the
   * bell and the chime are enough.
   */
  public dispatchNotification(
    title: string,
    body: string,
    type: InAppNotification['type'] = 'normal',
    options?: { alertDevice?: boolean }
  ) {
    this.notifications = [
      {
        id: `notif-${Date.now()}-${this.counter++}`,
        title,
        body,
        type,
        createdAt: new Date().toISOString(),
      },
      ...this.notifications,
    ].slice(0, MAX_STORED);
    this.persist();
    this.notifyListeners();
    this.playAudioChime();

    if (options?.alertDevice && typeof document !== 'undefined' && document.hidden) {
      void this.showOnDevice(title, body);
    }
  }

  public getNotifications(): InAppNotification[] {
    return [...this.notifications];
  }

  /** The notification center only holds unread entries, so reading one removes it. */
  public markAsRead(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.persist();
    this.notifyListeners();
  }

  public markAllAsRead() {
    this.notifications = [];
    this.persist();
    this.notifyListeners();
  }

  public subscribe(cb: (items: InAppNotification[]) => void) {
    this.listeners.push(cb);
    cb(this.notifications);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private persist() {
    if (!this.accountId) return;
    try {
      localStorage.setItem(storageKey(this.accountId), JSON.stringify(this.notifications));
    } catch {
      // Storage full or blocked: history just will not survive a reload.
    }
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.notifications);
    }
  }
}

export const notificationService = new NotificationService();
