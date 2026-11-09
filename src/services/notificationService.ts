// Service to handle Mobile & Desktop System Notifications for SPS Warehouse

let swRegistration: ServiceWorkerRegistration | null = null;

// Initialize and register service worker for mobile notifications
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    return reg;
  } catch (error) {
    console.warn('Service worker registration failed:', error);
    return null;
  }
};

// Play a pleasant, crisp notification chime using Web Audio API
export const playNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    
    // Note 1 (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Note 2 (880 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {
    // Ignore audio context auto-play limitations if blocked
  }
};

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

// Check current notification permission
export const getNotificationPermissionState = (): NotificationPermissionState => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

// Request notification permission from user and browser
export const requestNotificationPermission = async (): Promise<NotificationPermissionState> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Ensure service worker is registered
      await registerServiceWorker();
    }
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return Notification.permission;
  }
};

export interface SystemNotificationOptions {
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  renotify?: boolean;
  vibrate?: number[];
  silent?: boolean;
}

// Send system notification to mobile lock screen / status bar & desktop notification center
export const sendSystemNotification = async (
  title: string,
  options: SystemNotificationOptions
): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  // Play audio chime
  if (!options.silent) {
    playNotificationChime();
  }

  // Vibrate mobile device if supported
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(options.vibrate || [200, 100, 200]);
    } catch {
      // Ignored if user hasn't interacted
    }
  }

  const notificationOptions = {
    body: options.body,
    icon: options.icon || '/sps-logo.png',
    badge: options.badge || '/sps-logo.png',
    tag: options.tag || 'sps-alert',
    renotify: options.renotify ?? true,
    data: options.data || { url: '/' },
    vibrate: options.vibrate || [200, 100, 200],
  };

  // Preferred mobile PWA approach: via ServiceWorkerRegistration.showNotification
  try {
    if ('serviceWorker' in navigator) {
      let reg: ServiceWorkerRegistration | null = swRegistration;
      if (!reg) {
        const found = await navigator.serviceWorker.getRegistration();
        reg = found || null;
      }
      if (!reg) {
        reg = await registerServiceWorker();
      }

      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notificationOptions);
        return true;
      }
    }
  } catch (swErr) {
    console.warn('Service Worker showNotification failed, trying fallback:', swErr);
  }

  // Fallback: standard Web Notification API
  try {
    const notif = new Notification(title, notificationOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (err) {
    console.error('System notification creation failed:', err);
    return false;
  }
};

// Send an immediate test notification to verify mobile notifications
export const sendTestNotification = async (): Promise<boolean> => {
  return sendSystemNotification('Staff Request 70% Deposit', {
    body: 'Order #SPS-09112601 (Tony Mohab): Staff requested changing upfront deposit from 50% to 70% (2275 EGP).',
    tag: 'test-notification-' + Date.now(),
    data: { view: 'audit-log' },
  });
};
