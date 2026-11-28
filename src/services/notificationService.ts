// Service to handle Mobile & Desktop System Notifications for SPS Warehouse with Web Push Protocol

let swRegistration: ServiceWorkerRegistration | null = null;

// Public half of the Web Push (VAPID) key pair. The private half lives only in the
// Supabase "notify-push" function secrets - never in this repository.
export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BBp3GSSICglG-mKyUP6B-qAX6RGvwHI3kHr7Xp-HOFI6WNnXW_uuAW900JB0rFeTZ1cx6Zt8evYz5PESVXRkcvw';

// True once this device is registered for background push. Devices with background
// push get alerts from Supabase, so the in-app check doesn't show them a second time.
let pushActive = false;
export const isBackgroundPushActive = () => pushActive;

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

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

    const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    // Reuse the existing subscription only if it was made with the current key.
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options?.applicationServerKey, convertedKey)) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey.buffer as ArrayBuffer,
      });
    }

    if (sub) {
      // Save this device in Supabase so the "notify-push" function can reach it
      // even when the app is closed.
      const { supabase } = await import('./supabaseClient');
      const { error } = await supabase.rpc('register_push_subscription', {
        p_endpoint: sub.endpoint,
        p_subscription: sub.toJSON(),
        p_user_email: userEmail || null,
      });
      if (error) {
        console.warn('Could not save push subscription:', error.message);
        return false;
      }
      pushActive = true;
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
    icon: options.icon || '/sps-logo.png?v=4',
    badge: options.badge || '/sps-logo.png?v=4',
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
  const alertTitle = 'SPS Warehouse';
  const alertBody = 'This is an Alert Message confirming app notifications are working fine.';

  // Local test alert. (The old /api/push/test server endpoint never ran on Vercel;
  // background alerts now come from the Supabase "notify-push" function.)
  return sendSystemNotification(alertTitle, {
    body: alertBody,
    tag: 'test-notification-' + Date.now(),
    data: { view: 'audit-log' },
  });
};
