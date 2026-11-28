import React, { useEffect, useRef } from 'react';

const SITE_KEY = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;

/** True when a Cloudflare Turnstile site key is configured (public key, safe in the browser). */
export const captchaEnabled = Boolean(SITE_KEY);

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

interface CaptchaProps {
  onToken: (token: string) => void;
  resetKey?: number;
  /** Only show the box when Cloudflare thinks the visitor is suspicious. */
  quiet?: boolean;
}

export const Captcha: React.FC<CaptchaProps> = ({ onToken, resetKey = 0, quiet = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    const render = () => {
      if (!window.turnstile || !ref.current) return;
      if (widgetId.current) {
        window.turnstile.reset(widgetId.current);
        return;
      }
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        ...(quiet ? { appearance: 'interaction-only' } : {}),
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(''),
      });
    };
    if (window.turnstile) {
      render();
    } else if (!document.getElementById('cf-turnstile-script')) {
      const s = document.createElement('script');
      s.id = 'cf-turnstile-script';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      const t = setInterval(() => {
        if (window.turnstile) {
          clearInterval(t);
          render();
        }
      }, 300);
      return () => clearInterval(t);
    }
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
};
