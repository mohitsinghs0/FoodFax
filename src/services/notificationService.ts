import { BusinessNotification } from '../types';
import { MOCK_NOTIFICATIONS } from '../data/mockData';
import { firestoreSync } from './firestoreSyncService';

const NOTIFICATIONS_STORAGE_KEY = 'foodflow_business_notifications';

export const notificationService = {
  getStoredNotifications(): BusinessNotification[] {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return MOCK_NOTIFICATIONS;
  },

  saveNotifications(notifs: BusinessNotification[]): void {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
    } catch {
      // fallback
    }
  },

  async getNotifications(shopId: string = 'sharma-vada-pav'): Promise<BusinessNotification[]> {
    await new Promise((r) => setTimeout(r, 40));
    const all = this.getStoredNotifications();
    const localMatches = all.filter((n) => n.shopId === shopId);

    // Attempt to pull real notifications from Firestore
    try {
      const remoteNotifs = await firestoreSync.getNotificationsByShop(shopId);
      if (remoteNotifs && remoteNotifs.length > 0) {
        const notifMap = new Map<string, BusinessNotification>();
        localMatches.forEach((n) => notifMap.set(n.id, n));
        remoteNotifs.forEach((n) => notifMap.set(n.id, n));
        const combined = Array.from(notifMap.values());
        combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return combined;
      }
    } catch {
      // fallback
    }

    return localMatches;
  },

  async markAsRead(id: string): Promise<void> {
    const all = this.getStoredNotifications();
    const updated = all.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    this.saveNotifications(updated);
  },

  async markAllAsRead(shopId: string = 'sharma-vada-pav'): Promise<void> {
    const all = this.getStoredNotifications();
    const updated = all.map((n) => (n.shopId === shopId ? { ...n, isRead: true } : n));
    this.saveNotifications(updated);
  },

  async addNotification(data: Omit<BusinessNotification, 'id' | 'createdAt' | 'isRead'>): Promise<BusinessNotification> {
    const all = this.getStoredNotifications();
    const newNotif: BusinessNotification = {
      ...data,
      id: `notif-${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [newNotif, ...all];
    this.saveNotifications(updated);

    // Sync to Firestore for real-time shop notification delivery
    try {
      await firestoreSync.createNotification(newNotif);
    } catch (err) {
      console.warn('[NotificationService] Firestore notification sync failed:', err);
    }

    if (data.type === 'ALERT' || (data.type as string) === 'ORDER_CANCELLED') {
      this.playAlertChime();
    } else {
      this.playNewOrderAlert();
    }
    return newNotif;
  },

  /**
   * Play alert buzzer for order cancellation or high-priority warnings
   */
  playAlertChime(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(330, now + 0.15); // E4
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    } catch {
      // Audio context might be restricted
    }
  },

  /**
   * Play counter bell for incoming new orders
   */
  playNewOrderAlert(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Two-tone attention bell
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // Audio context might be restricted
    }
  },

  /**
   * Play an audible notification chime when order is READY using Web Audio API
   */
  playReadyChime(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const now = ctx.currentTime;
      
      // Bell harmonic 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Bell harmonic 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.18);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6
      gain2.gain.setValueAtTime(0.25, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.7);
      osc2.start(now + 0.18);
      osc2.stop(now + 1.0);
    } catch {
      // Audio context might be restricted before user interaction
    }

    // Gentle haptic feedback if mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([120, 80, 150]);
      } catch {
        // ignore
      }
    }
  },

  /**
   * Check browser notification permission and send system notification if allowed
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
    return false;
  },

  sendReadyNotification(tokenNumber: string, shopName: string): void {
    this.playReadyChime();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`Order Ready! Token ${tokenNumber}`, {
          body: `Please collect your food at ${shopName} counter.`,
          icon: '/favicon.ico',
        });
      } catch {
        // ignore
      }
    }
  },

  playChime(type: 'order_created' | 'order_ready' | 'order_status' | 'rush_mode' = 'order_created'): void {
    if (type === 'order_ready' || type === 'order_status') {
      this.playReadyChime();
    } else {
      this.playNewOrderAlert();
    }
  },
};

