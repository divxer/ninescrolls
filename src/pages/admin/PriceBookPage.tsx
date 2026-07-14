import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  appendCostVersion,
  createCatalogItem,
  listCatalogItems,
  listCostVersions,
  listSuppliers,
  rmbFen,
  type CatalogItem,
  type CostVersion,
  type Supplier,
} from '../../services/priceAdminService';

type CostState = {
  status: 'ACTIVE' | 'EXPIRING' | 'MISSING';
  current?: CostVersion;
  history: CostVersion[];
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

function classify(history: CostVersion[]): CostState {
  const today = todayIso();
  const current = history.find((version) => version.effectiveFrom <= today && today < version.effectiveTo);
  if (!current) return { status: 'MISSING', history };
  return { status: current.effectiveTo <= plusDays(30) ? 'EXPIRING' : 'ACTIVE', current, history };
}

const badgeClass: Record<CostState['status'], string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  EXPIRING: 'bg-amber-100 text-amber-800',
  MISSING: 'bg-error-container text-error',
};

const emptyItemForm = { sku: '', name: '', series: '', kind: 'OPTION' as CatalogItem['kind'] };
const newCostForm = () => ({ supplierId: '', unitCostRmb: '', effectiveFrom: todayIso(), effectiveTo: plusDays(180) });
const inputClass = 'rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20';

export function PriceBookPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [costs, setCosts] = useState<Record<string, CostState>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [costForm, setCostForm] = useState(newCostForm);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([listCatalogItems(), listSuppliers()])
      .then(async ([catalog, supplierList]) => {
        const entries = await Promise.all(catalog.items.map(async (item) => {
          const { items: history } = await listCostVersions(item.itemId);
          return [item.itemId, classify(history)] as const;
        }));
        setItems(catalog.items);
        setSuppliers(supplierList.items);
        setCosts(Object.fromEntries(entries));
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const attention = useMemo(() => Object.values(costs).filter((cost) => cost.status !== 'ACTIVE').length, [costs]);
  const bySeries = useMemo(() => {
    const groups: Record<string, CatalogItem[]> = {};
    for (const item of items) (groups[item.series] ??= []).push(item);
    return Object.entries(groups).sort(([left], [right]) => left.localeCompare(right));
  }, [items]);

  const onCreateItem = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCatalogItem({ ...itemForm, requiredOptionSkus: [], requiresSkus: [], excludesSkus: [] });
      setItemForm(emptyItemForm);
      reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const onAppendCost = async (itemId: string, event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await appendCostVersion({
        itemId,
        supplierId: costForm.supplierId,
        unitCostFen: Math.round(Number(costForm.unitCostRmb) * 100),
        effectiveFrom: costForm.effectiveFrom,
        effectiveTo: costForm.effectiveTo,
        priceSource: 'MANUAL_ENTRY',
      });
      setCostForm(newCostForm());
      reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-body text-xs font-bold uppercase tracking-[0.18em] text-secondary">Price administration</p>
          <h1 className="font-headline text-3xl font-black tracking-tight text-on-surface">Price Book</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Current supplier costs, validity windows, and catalog coverage.</p>
        </div>
        <Link to="/admin/suppliers" className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface no-underline transition hover:bg-surface-container-low">
          Manage suppliers
        </Link>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Price book summary">
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Supplier follow-up</p>
          <div className="mt-2 flex items-baseline gap-2">
            <strong data-testid="attention-count" className={`font-headline text-3xl font-black ${attention ? 'text-error' : 'text-emerald-700'}`}>{attention}</strong>
            <span className="text-sm text-on-surface-variant">expired, expiring, or missing</span>
          </div>
        </div>
        <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Catalog items</p>
          <strong className="mt-2 block font-headline text-3xl font-black text-on-surface">{items.length}</strong>
        </div>
      </section>

      {error && <div role="alert" className="mb-6 rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-error">{error}</div>}

      {loading ? (
        <div className="rounded-2xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">Loading price book…</div>
      ) : bySeries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">No catalog items have been added yet.</div>
      ) : bySeries.map(([series, group]) => (
        <section key={series} className="mb-6 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
          <div className="flex items-center justify-between bg-surface-container-low px-5 py-3">
            <h2 className="font-headline text-lg font-bold text-on-surface">{series}</h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{group.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-surface-container-low/60 text-left text-[11px] uppercase tracking-wider text-on-surface-variant">
                <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Item</th><th className="px-4 py-2">Kind</th><th className="px-4 py-2 text-right">Cost</th><th className="px-4 py-2">Validity</th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody>
                {group.map((item) => {
                  const cost = costs[item.itemId];
                  const status = cost?.status ?? 'MISSING';
                  const open = expanded === item.itemId;
                  return (
                    <Fragment key={item.itemId}>
                      <tr className="border-t border-outline-variant/30">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-on-surface">{item.sku}</td>
                        <td className="px-4 py-3 font-semibold text-on-surface">{item.name}</td>
                        <td className="px-4 py-3 text-xs text-on-surface-variant">{item.kind}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-on-surface">{rmbFen(cost?.current?.unitCostFen)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${badgeClass[status]}`}>{status}</span></td>
                        <td className="px-4 py-3 text-right"><button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : item.itemId)} className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container-low">{open ? 'Hide history' : 'History / add cost'}</button></td>
                      </tr>
                      {open && (
                        <tr className="border-t border-outline-variant/30 bg-surface-container-low/50">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="mb-4 space-y-2">
                              {(cost?.history ?? []).map((version) => <div key={`${version.effectiveFrom}-${version.supplierId}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-surface-container-lowest px-3 py-2 text-xs text-on-surface-variant"><span>{version.effectiveFrom} → {version.effectiveTo}</span><span className="font-mono font-semibold text-on-surface">{rmbFen(version.unitCostFen)}</span><span>{version.priceSource} · {version.createdBy}</span></div>)}
                              {!(cost?.history ?? []).length && <p className="text-sm text-on-surface-variant">No cost versions yet.</p>}
                            </div>
                            <form onSubmit={(event) => onAppendCost(item.itemId, event)} className="flex flex-wrap items-end gap-3">
                              <label className="text-xs font-semibold text-on-surface">Supplier<select required value={costForm.supplierId} onChange={(event) => setCostForm({ ...costForm, supplierId: event.target.value })} className={`${inputClass} mt-1 block`}><option value="">Select…</option>{suppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.name}</option>)}</select></label>
                              <label className="text-xs font-semibold text-on-surface">Cost (RMB)<input required type="number" step="0.01" min="0.01" value={costForm.unitCostRmb} onChange={(event) => setCostForm({ ...costForm, unitCostRmb: event.target.value })} className={`${inputClass} mt-1 block w-32`} /></label>
                              <label className="text-xs font-semibold text-on-surface">Effective from<input required type="date" value={costForm.effectiveFrom} onChange={(event) => setCostForm({ ...costForm, effectiveFrom: event.target.value })} className={`${inputClass} mt-1 block`} /></label>
                              <label className="text-xs font-semibold text-on-surface">Effective to<input required type="date" value={costForm.effectiveTo} onChange={(event) => setCostForm({ ...costForm, effectiveTo: event.target.value })} className={`${inputClass} mt-1 block`} /></label>
                              <button type="submit" disabled={saving} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-60">Add cost version</button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="mt-8 rounded-2xl bg-surface-container-low p-5 lg:p-6" aria-labelledby="add-catalog-item-heading">
        <h2 id="add-catalog-item-heading" className="font-headline text-xl font-bold text-on-surface">Add catalog item</h2>
        <form onSubmit={onCreateItem} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-semibold text-on-surface">SKU<input required value={itemForm.sku} onChange={(event) => setItemForm({ ...itemForm, sku: event.target.value })} className={`${inputClass} mt-2 w-full`} /></label>
          <label className="text-sm font-semibold text-on-surface lg:col-span-2">Name<input required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} className={`${inputClass} mt-2 w-full`} /></label>
          <label className="text-sm font-semibold text-on-surface">Series<input required value={itemForm.series} onChange={(event) => setItemForm({ ...itemForm, series: event.target.value })} className={`${inputClass} mt-2 w-full`} /></label>
          <label className="text-sm font-semibold text-on-surface">Kind<select value={itemForm.kind} onChange={(event) => setItemForm({ ...itemForm, kind: event.target.value as CatalogItem['kind'] })} className={`${inputClass} mt-2 w-full`}>{['MACHINE', 'OPTION', 'CONSUMABLE', 'SERVICE'].map((kind) => <option key={kind}>{kind}</option>)}</select></label>
          <div className="sm:col-span-2 lg:col-span-5"><button type="submit" disabled={saving} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm disabled:opacity-60">{saving ? 'Saving…' : 'Create item'}</button></div>
        </form>
      </section>
    </div>
  );
}
