import { useState } from 'react';
import {
  LEG_DIRECTIONS, LEG_DIRECTION_LABELS, CUSTOMS_STATUSES, CUSTOMS_STATUS_LABELS,
  type ShipmentLeg,
} from '../../types/logistics';

const FIELD = 'mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm';

export function LegForm({
  initial, onSubmit, onCancel,
}: {
  initial?: Partial<ShipmentLeg>;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    direction: initial?.direction ?? LEG_DIRECTIONS[0],
    carrier: initial?.carrier ?? '',
    trackingNumber: initial?.trackingNumber ?? '',
    trackingUrl: initial?.trackingUrl ?? '',
    freightForwarder: initial?.freightForwarder ?? '',
    blOrAwb: initial?.blOrAwb ?? '',
    containerNo: initial?.containerNo ?? '',
    customsRequired: initial?.customsRequired ?? false,
    customsStatus: initial?.customsStatus ?? '',
    declaredValueUSD: initial?.declaredValueUSD != null ? String(initial.declaredValueUSD) : '',
    hsCode: initial?.hsCode ?? '',
    shippedAt: initial?.shippedAt ?? '',
    clearedAt: initial?.clearedAt ?? '',
    deliveredAt: initial?.deliveredAt ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((p) => ({ ...p, [k]: v })); }

  function submit() {
    if (f.trackingUrl) {
      let ok = false;
      try { const u = new URL(f.trackingUrl); ok = u.protocol === 'http:' || u.protocol === 'https:'; } catch { ok = false; }
      if (!ok) { setErr('Tracking URL must start with http:// or https://'); return; }
    }
    setErr(null);
    const isEditing = Boolean(initial?.legId);
    const input: Record<string, unknown> = { direction: f.direction, customsRequired: f.customsRequired };
    const optional = <K extends keyof typeof f>(field: K) => {
      const value = f[field];
      if (value) input[field] = value;
      else if (isEditing && initial?.[field as keyof ShipmentLeg] != null) input[field] = null;
    };
    optional('carrier');
    optional('trackingNumber');
    optional('trackingUrl');
    optional('freightForwarder');
    optional('blOrAwb');
    optional('containerNo');
    optional('customsStatus');
    optional('hsCode');
    optional('shippedAt');
    optional('clearedAt');
    optional('deliveredAt');
    if (f.declaredValueUSD) input.declaredValueUSD = Number(f.declaredValueUSD);
    else if (isEditing && initial?.declaredValueUSD != null) input.declaredValueUSD = null;
    onSubmit(input);
  }

  return (
    <div className="rounded-lg border border-outline-variant p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">Direction
          <select aria-label="Direction" value={f.direction} onChange={(e) => set('direction', e.target.value as typeof f.direction)} className={FIELD}>
            {LEG_DIRECTIONS.map((d) => <option key={d} value={d}>{LEG_DIRECTION_LABELS[d]}</option>)}
          </select>
        </label>
        <label className="text-xs">Carrier
          <input aria-label="Carrier" value={f.carrier} onChange={(e) => set('carrier', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Tracking #
          <input aria-label="Tracking #" value={f.trackingNumber} onChange={(e) => set('trackingNumber', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Tracking URL
          <input aria-label="Tracking URL" value={f.trackingUrl} onChange={(e) => set('trackingUrl', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Freight forwarder
          <input aria-label="Freight forwarder" value={f.freightForwarder} onChange={(e) => set('freightForwarder', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">B/L or AWB
          <input aria-label="B/L or AWB" value={f.blOrAwb} onChange={(e) => set('blOrAwb', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Container #
          <input aria-label="Container #" value={f.containerNo} onChange={(e) => set('containerNo', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">HS code
          <input aria-label="HS code" value={f.hsCode} onChange={(e) => set('hsCode', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Declared value (USD)
          <input aria-label="Declared value (USD)" type="number" value={f.declaredValueUSD} onChange={(e) => set('declaredValueUSD', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Customs status
          <select aria-label="Customs status" value={f.customsStatus} onChange={(e) => set('customsStatus', e.target.value as typeof f.customsStatus)} className={FIELD}>
            <option value="">—</option>
            {CUSTOMS_STATUSES.map((s) => <option key={s} value={s}>{CUSTOMS_STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="text-xs">Shipped
          <input aria-label="Shipped" type="date" value={f.shippedAt} onChange={(e) => set('shippedAt', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Cleared
          <input aria-label="Cleared" type="date" value={f.clearedAt} onChange={(e) => set('clearedAt', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Delivered
          <input aria-label="Delivered" type="date" value={f.deliveredAt} onChange={(e) => set('deliveredAt', e.target.value)} className={FIELD} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={f.customsRequired} onChange={(e) => set('customsRequired', e.target.checked)} /> Customs required (this leg)
      </label>
      {err && <p className="text-error text-sm">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary">Save leg</button>
        <button onClick={onCancel} className="rounded-full border border-outline-variant px-4 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}
