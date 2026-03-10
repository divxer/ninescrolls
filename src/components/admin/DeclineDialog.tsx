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
      <p>Are you sure you want to decline this inquiry?</p>

      {error && <div className="admin-error">{error}</div>}

      <div className="form-field">
        <label>Reason *</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="admin-filter-select" style={{ width: '100%' }}>
          <option value="">Select a reason...</option>
          {DECLINE_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Additional Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button className="admin-btn-sm admin-btn-outline" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button className="admin-btn-sm admin-btn-danger" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Declining...' : 'Decline'}
        </button>
      </div>
    </Modal>
  );
}
