import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, subtitle, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-[0px_10px_30px_rgba(2,36,72,0.1)] border border-outline-variant/20 max-h-[80vh] flex flex-col${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-primary transition-colors bg-transparent border-none cursor-pointer z-10"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <h2 className="text-2xl font-bold tracking-tight text-primary font-headline">{title}</h2>
          {subtitle && <p className="text-sm text-on-surface-variant mt-1">{subtitle}</p>}
        </div>

        {/* Body */}
        <div className="px-8 py-4 flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-8 py-6 bg-surface-container-low/50 flex flex-col sm:flex-row-reverse gap-3 border-t border-outline-variant/10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
