import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface AppConfirmOptions {
  title: string;
  /** Plain sentences shown under the title. */
  message?: string;
  /** Big number lines, e.g. { label: 'Deducted for waiting orders', value: '43 pcs' }. */
  facts?: { label: string; value: string }[];
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type Pending = AppConfirmOptions & { resolve: (ok: boolean) => void };
let listener: ((p: Pending | null) => void) | null = null;

/** Styled replacement for window.confirm. Resolves true on Confirm, false on Cancel. */
export function appConfirm(opts: AppConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(window.confirm([opts.title, opts.message, ...(opts.facts || []).map((f) => `${f.label}: ${f.value}`), opts.note].filter(Boolean).join('\n\n')));
      return;
    }
    listener({ ...opts, resolve });
  });
}

export const AppConfirmHost: React.FC = () => {
  const [p, setP] = useState<Pending | null>(null);
  useEffect(() => {
    listener = setP;
    return () => { listener = null; };
  }, []);
  if (!p) return null;
  const close = (ok: boolean) => { p.resolve(ok); setP(null); };
  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Please check</span>
          </div>
          <button type="button" onClick={() => close(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100" title="Cancel">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">{p.title}</h3>
          {p.message && <p className="text-sm text-slate-600 leading-relaxed">{p.message}</p>}
          {p.facts && p.facts.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200">
              {p.facts.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-slate-600">{f.label}</span>
                  <span className="font-mono font-bold text-slate-900">{f.value}</span>
                </div>
              ))}
            </div>
          )}
          {p.note && <p className="text-xs text-slate-500 leading-relaxed">{p.note}</p>}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={() => close(false)} className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm border border-slate-200 min-h-[44px]">
              {p.cancelLabel || 'Cancel'}
            </button>
            <button type="button" autoFocus onClick={() => close(true)} className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm min-h-[44px]">
              {p.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
