import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  createSupplier,
  listSuppliers,
  updateSupplier,
  type Supplier,
} from '../../services/priceAdminService';

const EMPTY_FORM = { name: '', contact: '', defaultValidityDays: 180, notes: '' };

export function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listSuppliers()
      .then(({ items: suppliers }) => setItems(suppliers))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createSupplier({
        name: form.name,
        contact: form.contact || undefined,
        defaultValidityDays: form.defaultValidityDays,
        notes: form.notes || undefined,
      });
      setForm(EMPTY_FORM);
      reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (supplier: Supplier) => {
    setError(null);
    try {
      await updateSupplier({
        supplierId: supplier.supplierId,
        status: supplier.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      });
      reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const fieldClassName = 'w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body text-sm text-on-surface outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20';

  return (
    <div className="px-5 py-8 lg:px-8 lg:py-10">
      <header className="mb-8">
        <p className="mb-2 font-body text-xs font-bold uppercase tracking-[0.18em] text-secondary">Price administration</p>
        <h1 className="font-headline text-3xl font-black tracking-tight text-on-surface">Suppliers</h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-on-surface-variant">
          Internal only — supplier identities are OEM-confidential.
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <section aria-labelledby="supplier-list-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="supplier-list-heading" className="font-headline text-xl font-bold text-on-surface">Supplier directory</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Current OEM sourcing partners and account defaults.</p>
          </div>
          {!loading && <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{items.length} total</span>}
        </div>

        {loading ? (
          <div className="rounded-2xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">Loading suppliers…</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
            No suppliers have been added yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((supplier) => {
              const active = supplier.status === 'ACTIVE';
              return (
                <article key={supplier.supplierId} className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-headline text-lg font-bold text-on-surface">{supplier.name}</h3>
                      <p className="mt-1 text-sm text-on-surface-variant">{supplier.contact ?? 'No contact recorded'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-error-container text-error'}`}>
                      {supplier.status}
                    </span>
                  </div>
                  <dl className="my-5 border-y border-outline-variant/30 py-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <dt className="text-on-surface-variant">Default validity</dt>
                      <dd className="font-semibold text-on-surface">{supplier.defaultValidityDays} days</dd>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <dt className="text-on-surface-variant">Currency</dt>
                      <dd className="font-semibold text-on-surface">{supplier.currency}</dd>
                    </div>
                  </dl>
                  {supplier.notes && <p className="mb-4 text-sm leading-6 text-on-surface-variant">{supplier.notes}</p>}
                  <button
                    type="button"
                    onClick={() => toggleStatus(supplier)}
                    aria-label={`${active ? 'Suspend' : 'Reactivate'} supplier ${supplier.name}`}
                    className="rounded-full border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low"
                  >
                    {active ? 'Suspend supplier' : 'Reactivate supplier'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="add-supplier-heading" className="mt-10 rounded-2xl bg-surface-container-low p-5 lg:p-6">
        <h2 id="add-supplier-heading" className="font-headline text-xl font-bold text-on-surface">Add supplier</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Create an internal OEM record for price-book sourcing.</p>
        <form onSubmit={onCreate} className="mt-6 grid max-w-3xl gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-on-surface">
            Name
            <input required className={`${fieldClassName} mt-2`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Contact
            <input className={`${fieldClassName} mt-2`} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Default validity (days)
            <input required type="number" min={1} className={`${fieldClassName} mt-2`} value={form.defaultValidityDays} onChange={(event) => setForm({ ...form, defaultValidityDays: Number(event.target.value) })} />
          </label>
          <label className="text-sm font-semibold text-on-surface sm:col-span-2">
            Internal notes
            <textarea rows={3} className={`${fieldClassName} mt-2 resize-y`} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Creating…' : 'Create supplier'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
