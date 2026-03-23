import { useState } from 'react';
import { Modal } from './Modal';
import { DECLINE_REASONS } from '../../types/admin';

interface DeclineDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => Promise<void>;
  title?: string;
}

const inputClass = "w-full bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-sm px-4 py-2.5 text-on-surface placeholder:text-outline-variant transition-all";
const labelClass = "text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant font-label";

export function DeclineDialog({ open, onClose, onConfirm, title = 'Decline Inquiry' }: DeclineDialogProps) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!reason) { setError('Please select a reason'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(reason, note);
      setReason('');
      setNote('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Are you sure you want to decline this inquiry?"
      footer={
        <>
          <button
            className="flex-1 sm:flex-none px-8 py-2.5 bg-error text-on-error font-semibold text-sm rounded-lg hover:bg-error/90 transition-all active:scale-[0.98] disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Declining...' : 'Decline'}
          </button>
          <button
            className="flex-1 sm:flex-none px-8 py-2.5 bg-transparent border border-outline-variant text-on-surface-variant font-semibold text-sm rounded-lg hover:bg-surface-variant/20 hover:text-on-surface transition-all active:scale-[0.98]"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
        </>
      }
    >
      {error && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <form className="space-y-5">
        <div className="space-y-1.5">
          <label className={labelClass}>Reason *</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="">Select a reason...</option>
            {DECLINE_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Additional Notes</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Additional context..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </form>
    </Modal>
  );
}
