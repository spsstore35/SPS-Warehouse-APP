import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, X, Loader2, CheckCircle2 } from 'lucide-react';
import { User } from '../types/inventory';

interface ChangePasswordModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  currentUser,
  onClose,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setIsSubmitting(false);
    setIsDone(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanNew = newPassword.trim();
    if (cleanNew.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (cleanNew !== confirmPassword.trim()) {
      setError('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { supabase } = await import('../services/supabaseClient');
      // Re-check the current password with the live account, then set the new one in Supabase Auth.
      const { data: me } = await supabase.auth.getUser();
      const authEmail = me?.user?.email;
      if (!authEmail) throw new Error('You are signed out. Please sign in again.');
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: currentPassword,
      });
      if (reauthErr) {
        setError('Current password is incorrect.');
        setIsSubmitting(false);
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: cleanNew });
      if (updateErr) throw updateErr;

      setIsDone(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to update the password. Please try again.');
    }
    setIsSubmitting(false);
  };

  // Render in a portal: the modal is mounted inside the bottom nav and the
  // sticky header, both of which use backdrop-blur. A backdrop-filter (or
  // transform/filter) on an ancestor makes it the containing block for
  // fixed-position descendants, so without a portal this "fixed" overlay
  // would be trapped inside that bar and appear inline at the page edge.
  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
            <KeyRound className="w-4 h-4" />
            <span id="change-password-title">Change Password</span>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={resetAndClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isDone ? (
          <div className="p-6 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center mb-4 shadow-inner">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              Password updated
            </h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed max-w-xs">
              Use your new password the next time you log in.
            </p>
            <button
              type="button"
              onClick={resetAndClose}
              className="mt-6 w-full py-2.5 rounded-xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                New password (min 8 characters)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              />
            </div>

            {error && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 transition-colors"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
