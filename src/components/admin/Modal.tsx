import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <div
        className={`bg-surface-container-lowest rounded-xl shadow-elevated max-w-lg w-full mx-auto mt-[10vh] max-h-[80vh] overflow-y-auto${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
          <h2 className="font-headline text-lg font-bold text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            className="hover:bg-surface-container-low rounded-full p-1 transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-xl">close</span>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
