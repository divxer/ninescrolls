import toast from 'react-hot-toast';

/**
 * Notification helper — wraps react-hot-toast so the library is swappable
 * without touching every call site (Phase 2 spec risk #6).
 */
export const notify = {
    success(message: string) { toast.success(message); },
    error(message: string) { toast.error(message); },
    info(message: string) { toast(message); },
    loading(message: string, id?: string) {
        return toast.loading(message, id ? { id } : undefined);
    },
    dismiss(id?: string) { toast.dismiss(id); },
};
