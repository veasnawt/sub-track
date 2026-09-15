import React from 'react';
import { Delete, Close } from '@veasnawt/vicons';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  subscriptionName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  subscriptionName,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <Delete size={24} />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Remove Subscription?
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Are you sure you want to delete <span className="font-semibold text-slate-800 dark:text-slate-200">"{subscriptionName}"</span>? This will permanently remove its tracking and payment history.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Delete size={16} />
            <span>{loading ? 'Deleting...' : 'Delete Subscription'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
