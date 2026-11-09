import React, { useState } from 'react';
import { Bell, BellRing, CheckCircle, AlertTriangle, Send, X } from 'lucide-react';
import {
  NotificationPermissionState,
  requestNotificationPermission,
  sendTestNotification,
} from '../services/notificationService';

interface MobileNotificationBannerProps {
  permission: NotificationPermissionState;
  onPermissionChange: (perm: NotificationPermissionState) => void;
  onShowToast?: (msg: string) => void;
}

export const MobileNotificationBanner: React.FC<MobileNotificationBannerProps> = ({
  permission,
  onPermissionChange,
  onShowToast,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  if (isDismissed || permission === 'unsupported') {
    return null;
  }

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const res = await requestNotificationPermission();
      onPermissionChange(res);
      if (res === 'granted') {
        if (onShowToast) {
          onShowToast('✓ Mobile notifications enabled! Sending test notification...');
        }
        await sendTestNotification();
      } else if (res === 'denied') {
        if (onShowToast) {
          onShowToast('Notifications blocked. Please allow notifications in browser site settings.');
        }
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const ok = await sendTestNotification();
      if (ok && onShowToast) {
        onShowToast('Test notification sent! Check your phone status bar.');
      }
    } finally {
      setIsTesting(false);
    }
  };

  // State 1: Permission not yet requested ('default')
  if (permission === 'default') {
    return (
      <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-amber-500/10 border border-amber-300/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
              <span>Enable Phone & Desktop Notifications</span>
              <span className="px-2 py-0.2 bg-amber-200 text-amber-900 text-[10px] font-bold rounded-full">
                Recommended
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-medium">
              Get instant alerts on your phone lock screen whenever staff requests deposit approval or stock adjustments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isRequesting}
            onClick={handleEnable}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRequesting ? 'Requesting...' : 'Turn On Mobile Notifications'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors"
            title="Dismiss for now"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // State 2: Permission is denied ('denied')
  if (permission === 'denied') {
    return (
      <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            <strong>Phone Notifications Blocked:</strong> To receive alerts on your phone, open Chrome/Safari settings &gt; Site Settings &gt; Notifications &gt; Allow.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-rose-400 hover:text-rose-700 p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // State 3: Permission is granted ('granted') - Compact confirmation bar with Test button
  return (
    <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-2xs">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="font-semibold text-emerald-900">
          Mobile & Device Notifications Active
        </span>
        <span className="hidden sm:inline text-[11px] text-emerald-700">
          • You will receive push alerts on this device for approvals and order changes.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isTesting}
          onClick={handleTest}
          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          title="Send a live test notification to verify your phone"
        >
          <Send className="w-3 h-3" />
          <span>{isTesting ? 'Sending...' : 'Test Alert On My Phone'}</span>
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-emerald-500 hover:text-emerald-800 p-1 rounded-md"
          title="Hide banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
