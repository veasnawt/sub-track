import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Check, Close, Idea } from '@veasnawt/vicons';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  description?: string;
}

interface ToastContextType {
  toast: (options: { type?: 'success' | 'error' | 'info'; message: string; description?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({ type = 'info', message, description }: { type?: 'success' | 'error' | 'info'; message: string; description?: string }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message, description }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-200 transform translate-y-0 ${
              t.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700/50'
                : t.type === 'error'
                ? 'bg-rose-900/90 text-rose-100 border-rose-700/50'
                : 'bg-slate-900/90 text-slate-100 border-slate-700/50'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === 'success' && <Check size={18} className="text-emerald-400" />}
              {t.type === 'error' && <Close size={18} className="text-rose-400" />}
              {t.type === 'info' && <Idea size={18} className="text-indigo-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{t.message}</p>
              {t.description && <p className="text-xs opacity-80 mt-1">{t.description}</p>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-slate-400 hover:text-white p-0.5 rounded"
            >
              <Close size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
