import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 bg-white border border-[#E2E6DC] rounded-xl px-4 py-3 shadow-lg"
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#2D8060] mt-0.5 shrink-0" />}
            {t.type === 'error' && <ShieldAlert className="w-4 h-4 text-[#D95B55] mt-0.5 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-[#174B38] mt-0.5 shrink-0" />}
            <p className="text-xs text-[#202A25] leading-relaxed flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-[#5C6861] hover:text-[#202A25] cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
