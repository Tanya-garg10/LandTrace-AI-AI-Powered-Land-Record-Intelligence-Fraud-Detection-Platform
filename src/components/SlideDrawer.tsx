import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function SlideDrawer({
  open,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-2xl',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  widthClass?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#242B27]/35 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 w-full ${widthClass} bg-white h-full border-l border-[#E4E7DF] flex flex-col shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="px-6 py-4 border-b border-[#E4E7DF] flex items-start justify-between gap-4 bg-[#FAFAF6]">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-[#242B27] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-[#616D66] mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#616D66] hover:text-[#242B27] hover:bg-[#EAF0E9] rounded-lg transition-colors shrink-0 cursor-pointer"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function ModalDialog({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 'max-w-xl',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#242B27]/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative z-10 w-full ${maxWidth} bg-white border border-[#E4E7DF] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-4 border-b border-[#E4E7DF] flex items-start justify-between gap-4 bg-[#FAFAF6]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#242B27]">{title}</h2>
            {subtitle && <p className="text-xs text-[#616D66] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#616D66] hover:text-[#242B27] hover:bg-[#EAF0E9] rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
