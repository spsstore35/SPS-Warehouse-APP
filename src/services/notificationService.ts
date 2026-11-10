// Service to handle Mobile & Desktop System Notifications for SPS Warehouse with Web Push Protocol

let swRegistration: ServiceWorkerRegistration | null = null;

// Base64 helper for VAPID applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Initialize and register service worker for mobile notifications
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;

    // Automatically check and subscribe to background Web Push if permission is granted
    if (Notification.permission === 'granted') {
      subscribeToPushNotifications().catch(() => {});
    }

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

// Subscribe device to Background Web Push (Google Cloud Messaging / FCM)
export const subscribeToPushNotifications = async (userEmail?: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg) return false;

    // Fetch server VAPID public key
    let publicKey = 'BJMQAYWtCOp3egNjp-tbFtWvthIBCtRuDDH64erBwhqxkOecZMvkwt9ybmI2I9MXn2rnTq6ivNDd4w_bjB4338Q';
    try {
      const res = await fetch('/api/push/public-key');
      if (res.ok) {
        const data = await res.json();
        if (data.publicKey) publicKey = data.publicKey;
      }
    } catch {
      // Use fallback key
    }

    // Check existing subscription or create new
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey.buffer as ArrayBuffer,
      });
    }

    if (sub) {
      // Register subscription with server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userEmail,
        }),
      });
      return true;
    }
  } catch (err) {
    console.warn('Push subscription failed (device may use local notifications):', err);
  }
  return false;
};

// Request notification permission from user and browser
export const requestNotificationPermission = async (userEmail?: string): Promise<NotificationPermissionState> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Ensure service worker is registered & subscribe to background push
      await registerServiceWorker();
      await subscribeToPushNotifications(userEmail);
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
  // 1. Trigger via server Web Push (so it arrives from Google Cloud to Android lockscreen even if minimized)
  try {
    await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Staff Request 70% Deposit',
        body: 'Order #SPS-09112601 (Tony Mohab): Staff requested changing upfront deposit from 50% to 70% (2275 EGP).',
      }),
    });
  } catch {
    // If offline, fallback to local dispatch
  }

  // 2. Also dispatch locally via Service Worker as immediate feedback
  return sendSystemNotification('Staff Request 70% Deposit', {
    body: 'Order #SPS-09112601 (Tony Mohab): Staff requested changing upfront deposit from 50% to 70% (2275 EGP).',
    tag: 'test-notification-' + Date.now(),
    data: { view: 'audit-log' },
  });
};
