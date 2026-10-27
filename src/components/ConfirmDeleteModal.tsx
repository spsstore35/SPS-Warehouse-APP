import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemTitle?: string;
  message?: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Confirm Deletion',
  itemTitle,
  message,
  details,
  confirmLabel = 'Yes, Delete',
  cancelLabel = 'No, Cancel',
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const defaultMessage = itemTitle
    ? `Are you sure you want to delete "${itemTitle}"?`
    : 'Are you sure you want to delete this item?';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
      >
        {/* Top Header bar with close button */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-wider">
            <Trash2 className="w-4 h-4" />
            <span id="confirm-delete-title">{title}</span>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 text-center flex flex-col items-center">
          {/* Red Alert Icon */}
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-600 flex items-center justify-center mb-4 shadow-inner">
            <AlertTriangle className="w-7 h-7 text-rose-600" />
          </div>

          {/* Primary Question */}
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug max-w-sm">
            {message || defaultMessage}
          </h3>

          {/* Warning / Explanation subtext */}
          <p className="mt-2 text-xs text-slate-500 leading-relaxed max-w-xs">
            {details || 'This action cannot be undone. The selected data will be permanently removed from the system.'}
          </p>

          {/* Action Buttons: Red "Yes" and Neutral "No" */}
          <div className="mt-6 w-full grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onCancel}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200 transition-colors flex items-center justify-center gap-1.5 min-h-[44px] disabled:opacity-50"
            >
              <span>{cancelLabel}</span>
            </button>

            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/20 transition-colors flex items-center justify-center gap-1.5 min-h-[44px] disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{confirmLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
