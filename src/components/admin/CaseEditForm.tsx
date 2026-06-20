import { useState } from 'react';
import { RELATED_ENTITY_TYPES, type LogisticsCase } from '../../types/logistics';

const FIELD = 'mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm';

export function CaseEditForm({
  logisticsCase: c, onSubmit, onCancel,
}: {
  logisticsCase: LogisticsCase;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    customerName: c.customerName,
    contactName: c.contactName ?? '',
    customsRequired: c.customsRequired,
    relatedOrderId: c.relatedOrderId ?? '',
    relatedEntityType: c.relatedEntityType ?? '',
    relatedEntityId: c.relatedEntityId ?? '',
    notes: c.notes ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((p) => ({ ...p, [k]: v })); }

  function submit() {
    if (!f.customerName.trim()) { setErr('Customer name is required'); return; }
    // relatedEntityType and relatedEntityId must both be empty or both set
    if (Boolean(f.relatedEntityType) !== Boolean(f.relatedEntityId.trim())) {
      setErr('Related entity type and ID must both be set or both empty'); return;
    }
    setErr(null);
    onSubmit({
      customerName: f.customerName.trim(),
      contactName: f.contactName,
      customsRequired: f.customsRequired,
      relatedOrderId: f.relatedOrderId,
      relatedEntityType: f.relatedEntityType || null,
      relatedEntityId: f.relatedEntityId || null,
      notes: f.notes,
    });
  }

  return (
    <div className="rounded-xl border border-outline-variant p-4 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Edit case</h2>
      {err && <p className="text-error text-sm">{err}</p>}
      <label className="block text-xs">Customer
        <input aria-label="Customer" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} className={FIELD} />
      </label>
      <label className="block text-xs">Contact
        <input aria-label="Contact" value={f.contactName} onChange={(e) => set('contactName', e.target.value)} className={FIELD} />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={f.customsRequired} onChange={(e) => set('customsRequired', e.target.checked)} /> Customs required
      </label>
      <label className="block text-xs">Related order ID
        <input aria-label="Related order ID" value={f.relatedOrderId} onChange={(e) => set('relatedOrderId', e.target.value)} className={FIELD} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">Related entity type
          <select aria-label="Related entity type" value={f.relatedEntityType} onChange={(e) => set('relatedEntityType', e.target.value as typeof f.relatedEntityType)} className={FIELD}>
            <option value="">—</option>
            {RELATED_ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-xs">Related entity ID
          <input aria-label="Related entity ID" value={f.relatedEntityId} onChange={(e) => set('relatedEntityId', e.target.value)} className={FIELD} />
        </label>
      </div>
      <label className="block text-xs">Notes
        <textarea aria-label="Notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={FIELD} />
      </label>
      <div className="flex gap-2">
        <button onClick={submit} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary">Save</button>
        <button onClick={onCancel} className="rounded-full border border-outline-variant px-4 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}
