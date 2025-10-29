import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'info';

type Toast = { id: string; message: string; type: ToastType };

type Context = { addToast: (message: string, type?: ToastType, duration?: number) => void } | undefined;

const ToastContext = createContext<Context>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = String(Date.now()) + Math.random().toString(16).slice(2, 8);
    const t: Toast = { id, message, type };
    setToasts((s) => [...s, t]);
    // remove after duration
    setTimeout(() => setToasts((s) => s.filter(x => x.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div id="bmf-toast-container" style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              style={{
                maxWidth: 320,
                padding: '10px 12px',
                borderRadius: 8,
                color: '#fff',
                boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                fontSize: 14,
                lineHeight: '1.2',
              }}
            >
              <div style={{ background: t.type === 'success' ? '#16a34a' : t.type === 'error' ? '#dc2626' : '#0ea5e9', padding: '10px 12px', borderRadius: 8 }}>
                {t.message}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.addToast;
}

export default ToastProvider;
