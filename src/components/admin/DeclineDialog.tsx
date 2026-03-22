import { useState } from 'react';
import { Modal } from './Modal';
import { DECLINE_REASONS } from '../../types/admin';

interface DeclineDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => Promise<void>;
  title?: string;
}

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
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-on-surface-variant mb-4">
        Are you sure you want to decline this inquiry?
      </p>

      {error && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Reason *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          >
            <option value="">Select a reason...</option>
            {DECLINE_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Additional Notes
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <button
          className="border border-outline-variant text-on-surface px-4 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-low transition-colors"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          className="bg-error text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-error/90 transition-colors disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Declining...' : 'Decline'}
        </button>
      </div>
    </Modal>
  );
}
