import { motion } from 'framer-motion';

import { ReactNode } from 'react';

type ConfirmModalProps = {
  open: boolean;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'neutral' | 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ open, title = 'Confirm', message = '', confirmLabel = 'OK', cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  const confirmClass = variant === 'primary' ? 'bg-primary-600 text-white' : variant === 'danger' ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-800';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.14 }} className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {message && <div className="text-sm text-neutral-600 mb-4">{message}</div>}
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 rounded" onClick={onCancel}>{cancelLabel}</button>
          <button className={`px-4 py-2 rounded ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}
