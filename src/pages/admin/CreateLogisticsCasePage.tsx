import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as svc from '../../services/logisticsAdminService';
import {
  CASE_TYPES, CASE_TYPE_LABELS, RELATED_ENTITY_TYPES,
} from '../../types/logistics';

export function CreateLogisticsCasePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    caseType: CASE_TYPES[0] as string,
    customerName: '', contactName: '', customsRequired: false,
    relatedOrderId: '', relatedEntityType: '', relatedEntityId: '', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.customerName.trim()) { setErr('Customer name is required'); return; }
    // relatedEntityType and relatedEntityId must both be empty or both set
    if (Boolean(form.relatedEntityType) !== Boolean(form.relatedEntityId.trim())) {
      setErr('Related entity type and ID must both be set or both empty'); return;
    }
    setBusy(true); setErr(null);
    try {
      const input: Record<string, unknown> = {
        caseType: form.caseType, customerName: form.customerName.trim(),
        customsRequired: form.customsRequired,
      };
      if (form.contactName) input.contactName = form.contactName;
      if (form.relatedOrderId) input.relatedOrderId = form.relatedOrderId;
      if (form.relatedEntityType) { input.relatedEntityType = form.relatedEntityType; input.relatedEntityId = form.relatedEntityId; }
      if (form.notes) input.notes = form.notes;
      const created = await svc.createLogisticsCase(input) as { caseId?: string } | null;
      if (created?.caseId) navigate(`/admin/logistics/${created.caseId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create case');
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h1 className="text-2xl font-bold text-on-surface">New Logistics Case</h1>
      {err && <p className="text-error text-sm">{err}</p>}

      <label className="block text-sm">Case type
        <select value={form.caseType} onChange={(e) => set('caseType', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2">
          {CASE_TYPES.map((t) => <option key={t} value={t}>{CASE_TYPE_LABELS[t]}</option>)}
        </select>
      </label>

      <label className="block text-sm">Customer *
        <input value={form.customerName} onChange={(e) => set('customerName', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
      </label>

      <label className="block text-sm">Contact
        <input value={form.contactName} onChange={(e) => set('contactName', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.customsRequired} onChange={(e) => set('customsRequired', e.target.checked)} />
        Customs required
      </label>

      <label className="block text-sm">Related order ID
        <input value={form.relatedOrderId} onChange={(e) => set('relatedOrderId', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">Related entity type
          <select value={form.relatedEntityType} onChange={(e) => set('relatedEntityType', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2">
            <option value="">—</option>
            {RELATED_ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-sm">Related entity ID
          <input value={form.relatedEntityId} onChange={(e) => set('relatedEntityId', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
        </label>
      </div>

      <label className="block text-sm">Notes
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
      </label>

      <button onClick={submit} disabled={busy}
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
        {busy ? 'Creating…' : 'Create Case'}
      </button>
    </div>
  );
}
