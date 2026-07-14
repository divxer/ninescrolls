import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createQuotationDraft,
  getQuotation,
  listCatalogItems,
  marginPct,
  rmbFen,
  updateQuotationDraft,
  usd,
  type CatalogItem,
  type QuotationSummary,
} from "../../services/priceAdminService";
import {
  catalogMatches,
  lineActual,
  marginFor,
  preview,
  reconcileServerLines,
  toInput,
  type DraftLine,
} from "./quotationWorkbenchModel";
import { isQuotationFixtureUrl } from "./quotationFixtureGate";

type SaveState = "idle" | "saving" | "saved";
const productArt = "/assets/images/redesign/products/icp-rie-standardized.webp";

export function QuotationWorkbenchPage() {
  const { quotationNumber } = useParams<{ quotationNumber?: string }>();
  const location = useLocation();
  const fixture = import.meta.env.DEV
    && isQuotationFixtureUrl(location.pathname, location.search, true);
  const navigate = useNavigate();
  const [identity, setIdentity] = useState(quotationNumber ?? "");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]),
    [customerName, setCustomerName] = useState(""),
    [schemeLabel, setSchemeLabel] = useState("Standard"),
    [rfqId, setRfqId] = useState(""),
    [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]),
    [saved, setSaved] = useState<QuotationSummary | null>(null),
    [version, setVersion] = useState<{
      version: number;
      revision: number;
    } | null>(null);
  const [query, setQuery] = useState(""),
    [kindFilter, setKindFilter] = useState<CatalogItem["kind"] | null>(null),
    [menu, setMenu] = useState(false),
    [validation, setValidation] = useState(false),
    [custom, setCustom] = useState(false),
    [customLabel, setCustomLabel] = useState(""),
    [customValue, setCustomValue] = useState("");
  const [editing, setEditing] = useState<string | null>(null),
    [editValue, setEditValue] = useState(""),
    [saveState, setSaveState] = useState<SaveState>("idle"),
    [error, setError] = useState("");
  const escaped = useRef(false),
    keySeq = useRef(0);

  useEffect(() => {
    if (fixture) return;
    listCatalogItems()
      .then((r) => setCatalog(r.items))
      .catch((e) => setError(String(e)));
  }, [fixture]);
  useEffect(() => {
    if (!fixture) return;
    import("./quotationWorkbenchFixture").then(
      ({ quotationFixtureCatalog, quotationFixtureSnapshot }) => {
        setCatalog(quotationFixtureCatalog);
        setIdentity(quotationFixtureSnapshot.quotationNumber);
        setCustomerName(quotationFixtureSnapshot.customerName);
        setSchemeLabel(quotationFixtureSnapshot.schemeLabel);
        setRfqId(String(quotationFixtureSnapshot.rfqId ?? ""));
        setValidUntil(String(quotationFixtureSnapshot.validUntil ?? ""));
        setSaved(quotationFixtureSnapshot);
        setVersion(quotationFixtureSnapshot);
        setLines(reconcileServerLines(quotationFixtureSnapshot.lines ?? []));
      }
    );
  }, [fixture]);
  useEffect(() => {
    if (fixture || !quotationNumber) return;
    getQuotation(quotationNumber)
      .then((r) => {
        const q = r.versions.at(-1);
        if (!q) throw new Error("Quotation not found");
        applyServer(q);
        setIdentity(q.quotationNumber);
        setCustomerName(q.customerName);
        setSchemeLabel(q.schemeLabel);
        setRfqId(String(q.rfqId ?? ""));
        setValidUntil(String(q.validUntil ?? ""));
      })
      .catch((e) => setError(String(e)));
  }, [fixture, quotationNumber]);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!event.altKey) return;
      const kind =
        event.key.toLowerCase() === "o"
          ? "OPTION"
          : event.key.toLowerCase() === "s"
          ? "SERVICE"
          : event.key.toLowerCase() === "c"
          ? "CUSTOM"
          : "";
      if (!kind) return;
      event.preventDefault();
      setMenu(true);
      if (kind === "CUSTOM") setCustom(true);
      else setKindFilter(kind as CatalogItem["kind"]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const applyServer = (result: QuotationSummary) => {
    setSaved(result);
    setVersion(result);
    setLines(reconcileServerLines(result.lines ?? []));
  };
  const filtered = useMemo(
    () => catalog.filter((item) =>
      (!kindFilter || item.kind === kindFilter)
      && catalogMatches(item, query)
      && !lines.some((line) => line.itemId === item.itemId)
      && (item.kind !== "MACHINE" || !lines.some((line) => (line.snapshot?.kind ?? line.item?.kind) === "MACHINE"))
    ),
    [catalog, kindFilter, lines, query]
  );
  const totals = useMemo(() => preview(lines), [lines]);
  const dirty = useMemo(
    () =>
      !saved
        ? lines.length > 0
        : lines.some(
            (line, i) =>
              line.qty !== saved.lines?.[i]?.qty ||
              line.actualUnitUsdCents !==
                (saved.lines?.[i]?.actualUnitUsdCents ?? undefined)
          ) || totals.actualTotal !== saved.actualTotalUsdCents,
    [lines, saved, totals.actualTotal]
  );
  const shownTotals =
    dirty || !saved
      ? totals
      : {
          ...totals,
          costTotal: saved.totalCostUsdCents,
          suggestedTotal: saved.suggestedTotalUsdCents,
          actualTotal: saved.actualTotalUsdCents,
          actualMarginBp: saved.actualMarginBp,
        };
  const issues = useMemo(
    () =>
      lines.filter(
        (line) =>
          line.snapshot?.costStatus && line.snapshot.costStatus !== "ACTIVE"
      ),
    [lines]
  );
  const patch = (key: string, changes: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line))
    );
  const addCatalog = (item: CatalogItem) => {
    setLines((current) => {
      const duplicate = current.some((line) => line.itemId === item.itemId);
      const hasMachine = current.some((line) => (line.snapshot?.kind ?? line.item?.kind) === "MACHINE");
      if (duplicate || (item.kind === "MACHINE" && hasMachine)) return current;
      return [...current,
      {
        key: `draft:${keySeq.current++}`,
        itemId: item.itemId,
        sku: item.sku,
        qty: 1,
        lineType: "NORMAL",
        item,
      }];
    });
    setMenu(false);
  };
  const addCustom = () => {
    const cents = Math.round(Number(customValue.replace(/[$,]/g, "")) * 100);
    if (!customLabel.trim() || !Number.isFinite(cents) || cents < 0) return;
    setLines((current) => [
      ...current,
      {
        key: `custom:${keySeq.current++}`,
        qty: 1,
        lineType: "SURCHARGE",
        surchargeUsdCents: cents,
        actualUnitUsdCents: cents,
        sku: customLabel.trim(),
        overrideReason: customLabel.trim(),
        customLabel: customLabel.trim(),
      },
    ]);
    setCustom(false);
    setMenu(false);
    setCustomLabel("");
    setCustomValue("");
  };
  const openEdit = (line: DraftLine) => {
    escaped.current = false;
    setEditing(line.key);
    const actual = lineActual(line);
    setEditValue(actual == null ? "" : (actual / 100).toFixed(2));
  };
  const commitEdit = (key: string, next = false) => {
    if (escaped.current) {
      escaped.current = false;
      return;
    }
    const cents = Math.round(Number(editValue.replace(/[$,]/g, "")) * 100);
    if (Number.isFinite(cents)) patch(key, { actualUnitUsdCents: cents });
    if (next) {
      const index = lines.findIndex((line) => line.key === key);
      const target = lines[index + 1];
      if (target) {
        setEditing(target.key);
        const actual = lineActual(target);
        setEditValue(actual == null ? "" : (actual / 100).toFixed(2));
        return;
      }
    }
    setEditing(null);
  };
  const onEditKey = (event: KeyboardEvent<HTMLInputElement>, key: string) => {
    if (event.key === "Escape") {
      event.preventDefault();
      escaped.current = true;
      setEditing(null);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitEdit(key);
    } else if (event.key === "Tab") {
      event.preventDefault();
      commitEdit(key, true);
    }
  };
  const save = async () => {
    setSaveState("saving");
    setError("");
    if (fixture) {
      const totals = preview(lines);
      setSaved((current) => current ? {
        ...current,
        revision: current.revision + 1,
        actualTotalUsdCents: totals.actualTotal,
        actualMarginBp: totals.actualMarginBp,
        updatedAt: new Date().toISOString(),
      } : current);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
      return;
    }
    try {
      const payload = lines.map(toInput);
      const result =
        identity && version
          ? await updateQuotationDraft({
              quotationNumber: identity,
              version: version.version,
              expectedRevision: version.revision,
              customerName,
              validUntil: validUntil || undefined,
              lines: payload,
            })
          : await createQuotationDraft({
              schemeLabel,
              customerName,
              rfqId: rfqId || undefined,
              validUntil: validUntil || undefined,
              lines: payload,
            });
      applyServer(result);
      if (!identity) {
        setIdentity(result.quotationNumber);
        navigate(`/admin/quotations/${result.quotationNumber}`, {
          replace: true,
        });
      }
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setSaveState("idle");
    }
  };

  return (
    <div className="quotation-workbench min-h-[calc(100vh-5rem)] bg-surface-container-lowest text-on-surface">
      <WorkbenchHeader
        saved={saved}
        customerName={customerName}
        schemeLabel={schemeLabel}
        save={save}
        saveState={saveState}
      />
      <section className="mx-5 mt-4 grid gap-px overflow-hidden rounded-xl border border-outline-variant/40 bg-outline-variant/40 sm:grid-cols-3">
        <Context label="Pricing">
          <input
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 block w-full border-0 bg-transparent p-0 text-sm font-semibold normal-case text-on-surface outline-none"
          />
        </Context>
        <Context label="Catalog">
          <input
            aria-label="Scheme"
            value={schemeLabel}
            onChange={(e) => setSchemeLabel(e.target.value)}
            className="mt-1 block w-full border-0 bg-transparent p-0 text-sm font-semibold normal-case text-on-surface outline-none"
          />
        </Context>
        <Context label="Validity">
          <input
            type="date"
            aria-label="Valid until"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="mt-1 block w-full border-0 bg-transparent p-0 text-sm font-semibold normal-case text-on-surface outline-none"
          />
        </Context>
      </section>
      {error && (
        <p
          role="alert"
          className="mx-5 mt-3 rounded-lg bg-error-container px-4 py-2 text-sm text-error"
        >
          {error}
        </p>
      )}
      <main className="mt-4 min-w-0">
        <CatalogToolbar
          query={query}
          setQuery={setQuery}
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
          menu={menu}
          setMenu={setMenu}
          filtered={filtered}
          addCatalog={addCatalog}
          showCustom={() => setCustom(true)}
          issueCount={issues.length}
          validation={validation}
          setValidation={setValidation}
        />
        <BomTable
          lines={lines}
          totals={shownTotals}
          dirty={dirty}
          editing={editing}
          editValue={editValue}
          setEditValue={setEditValue}
          patch={patch}
          openEdit={openEdit}
          onEditKey={onEditKey}
          commitEdit={commitEdit}
        />
      </main>
      {custom && (
        <CustomDialog
          label={customLabel}
          value={customValue}
          setLabel={setCustomLabel}
          setValue={setCustomValue}
          add={addCustom}
          close={() => setCustom(false)}
        />
      )}
      {validation && (
        <ValidationDrawer issues={issues} close={() => setValidation(false)} />
      )}
      <footer className="sticky bottom-0 z-30 grid gap-px border-t border-outline-variant bg-outline-variant/30 p-px shadow-[0_-4px_18px_rgba(0,0,0,.08)] sm:grid-cols-4">
        <Summary
          label="Supplier cost"
          value={usd(saved || dirty ? shownTotals.costTotal : null)}
        />
        <Summary
          label="Suggested quote"
          value={usd(saved || dirty ? shownTotals.suggestedTotal : null)}
        />
        <Summary
          label="Actual quote"
          value={usd(saved || dirty ? shownTotals.actualTotal : null)}
          accent
        />
        <Summary
          label="Actual margin"
          value={marginPct(dirty || !saved ? shownTotals.actualMarginBp : saved.actualMarginBp)}
          accent
        />
      </footer>
    </div>
  );
}

function WorkbenchHeader({
  saved,
  customerName,
  schemeLabel,
  save,
  saveState,
}: {
  saved: QuotationSummary | null;
  customerName: string;
  schemeLabel: string;
  save: () => void;
  saveState: SaveState;
}) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-outline-variant/30 px-5 py-4">
      <Link
        to="/admin/quotations"
        className="rounded-lg p-2 text-on-surface no-underline"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </Link>
      <div>
        <h1 className="font-headline text-2xl font-black">
          Quotation Workbench
        </h1>
        <p className="text-xs text-on-surface-variant">
          {saved?.quotationNumber ?? "New quotation"} ·{" "}
          {customerName || "Unsaved customer"} · {schemeLabel}
        </p>
      </div>
      <div className="ml-auto flex gap-2">
        <button
          title="PDF template required"
          disabled
          className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold opacity-45"
        >
          Preview quote
        </button>
        <button
          onClick={save}
          disabled={saveState === "saving"}
          className="min-w-32 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm"
        >
          {saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
            ? "Saved ✓"
            : "Save Draft"}
        </button>
      </div>
    </header>
  );
}
function Context({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="bg-surface px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
      {label}
      {children}
    </label>
  );
}
function CatalogToolbar({
  query,
  setQuery,
  kindFilter,
  setKindFilter,
  menu,
  setMenu,
  filtered,
  addCatalog,
  showCustom,
  issueCount,
  validation,
  setValidation,
}: {
  query: string;
  setQuery: (v: string) => void;
  kindFilter: CatalogItem["kind"] | null;
  setKindFilter: (v: CatalogItem["kind"] | null) => void;
  menu: boolean;
  setMenu: (v: boolean) => void;
  filtered: CatalogItem[];
  addCatalog: (i: CatalogItem) => void;
  showCustom: () => void;
  issueCount: number;
  validation: boolean;
  setValidation: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-outline-variant/30 px-5 py-3">
      <div className="relative min-w-56 flex-1">
        <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant">
          search
        </span>
        <input
          type="search"
          aria-label="Catalog search"
          placeholder="Search name, SKU, supplier code…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setKindFilter(null);
          }}
          className="w-full rounded-xl border border-outline-variant bg-surface py-2 pl-10 pr-3 text-sm outline-none"
        />
      </div>
      <div className="relative">
        <button
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
          className="flex items-center gap-2 rounded-xl border border-secondary px-4 py-2 text-sm font-bold text-secondary"
        >
          <span className="material-symbols-outlined">add</span>Add item
        </button>
        {menu && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 max-h-72 w-80 overflow-auto rounded-xl border border-outline-variant bg-surface p-1 shadow-xl"
          >
            <div className="grid grid-cols-3 gap-1 border-b p-1">
              {(["OPTION", "SERVICE"] as const).map((kind) => (
                <button
                  key={kind}
                  role="menuitem"
                  aria-pressed={kindFilter === kind}
                  onClick={() => setKindFilter(kind)}
                  className="rounded-lg px-2 py-1.5 text-sm font-bold"
                >
                  {kind[0] + kind.slice(1).toLowerCase()}
                </button>
              ))}
              <button
                role="menuitem"
                onClick={showCustom}
                className="rounded-lg px-2 py-1.5 text-sm font-bold"
              >
                Custom
              </button>
            </div>
            {filtered.map((item) => (
              <button
                key={item.itemId}
                role="menuitem"
                onClick={() => addCatalog(item)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-container-low"
              >
                <b>
                  {item.kind === "MACHINE"
                    ? "Machine · "
                    : `${item.kind[0]}${item.kind.slice(1).toLowerCase()} · `}
                  {item.name}
                </b>
                <small className="block text-on-surface-variant">
                  {item.sku}
                </small>
              </button>
            ))}
            {!filtered.length && (
              <p className="p-3 text-sm text-on-surface-variant">
                No matching catalog items.
              </p>
            )}
          </div>
        )}
      </div>
      <button
        aria-expanded={validation}
        onClick={() => setValidation(!validation)}
        className="ml-auto rounded-xl border border-outline-variant px-3 py-2 text-sm font-bold"
      >
        Validation ({issueCount})
      </button>
    </div>
  );
}

function BomTable({
  lines,
  totals,
  dirty,
  editing,
  editValue,
  setEditValue,
  patch,
  openEdit,
  onEditKey,
  commitEdit,
}: {
  lines: DraftLine[];
  totals: ReturnType<typeof preview>;
  dirty: boolean;
  editing: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  patch: (k: string, v: Partial<DraftLine>) => void;
  openEdit: (l: DraftLine) => void;
  onEditKey: (e: KeyboardEvent<HTMLInputElement>, k: string) => void;
  commitEdit: (k: string) => void;
}) {
  const baseIndex = lines.findIndex(
    (line) => (line.snapshot?.kind ?? line.item?.kind) === "MACHINE"
  );
  return (
    <div className="max-h-[54vh] overflow-auto">
      <table className="w-full min-w-[1000px] border-collapse text-sm">
        <thead className="sticky top-0 z-20 bg-surface-container-low text-[10px] uppercase tracking-wider text-on-surface-variant shadow-sm">
          <tr>
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-3 py-3 text-left">Item / Configuration</th>
            <th>Qty</th>
            <th className="text-right">
              Supplier Cost
              <br />
              (RMB)
            </th>
            <th className="text-right">
              Suggested
              <br />
              (USD)
            </th>
            <th className="text-right">
              Actual
              <br />
              (USD)
            </th>
            <th className="text-right">Margin</th>
            <th className="px-4 text-right">% of Quote</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <BomRow
              key={line.key}
              line={line}
              index={index}
              isBase={index === baseIndex}
              share={totals.shares[index]}
              editing={editing}
              editValue={editValue}
              setEditValue={setEditValue}
              patch={patch}
              openEdit={openEdit}
              onEditKey={onEditKey}
              commitEdit={commitEdit}
            />
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 z-20 bg-surface shadow-[0_-1px_5px_rgba(0,0,0,.08)]">
          <tr>
            <td colSpan={3} className="px-4 py-4 font-headline font-black">
              Total (USD)
              {dirty && (
                <small className="ml-2 font-sans font-normal text-secondary">
                  Unsaved preview
                </small>
              )}
            </td>
            <td className="text-right font-mono">{usd(totals.costTotal)}</td>
            <td className="text-right font-mono">
              {usd(totals.suggestedTotal)}
            </td>
            <td className="text-right font-mono text-lg font-black">
              {usd(totals.actualTotal)}
            </td>
            <td />
            <td className="px-4 text-right">
              {lines.length && totals.actualTotal != null ? "100%" : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
      {!lines.length && (
        <div className="p-12 text-center text-sm text-on-surface-variant">
          Search and select a machine, option, service, or custom item to begin
          the BOM.
        </div>
      )}
    </div>
  );
}
function BomRow({
  line,
  index,
  isBase,
  share,
  editing,
  editValue,
  setEditValue,
  patch,
  openEdit,
  onEditKey,
  commitEdit,
}: {
  line: DraftLine;
  index: number;
  isBase: boolean;
  share: number | null;
  editing: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  patch: (k: string, v: Partial<DraftLine>) => void;
  openEdit: (l: DraftLine) => void;
  onEditKey: (e: KeyboardEvent<HTMLInputElement>, k: string) => void;
  commitEdit: (k: string) => void;
}) {
  const snap = line.snapshot;
  const actual = lineActual(line);
  const before = marginFor(
    snap?.actualUnitUsdCents ?? actual,
    snap?.unitCostUsdCents
  );
  const after = marginFor(
    Math.round(Number(editValue || 0) * 100),
    snap?.unitCostUsdCents
  );
  const delta = snap?.costDeltaFen;
  return (
    <tr
      className={`border-b border-outline-variant/25 ${
        isBase
          ? "sticky top-9 z-10 bg-surface-container-lowest shadow-sm"
          : snap?.costStatus === "MISSING"
          ? "bg-error-container/20"
          : ""
      }`}
    >
      <td className="px-4 py-3">{isBase ? "▾" : index + 1}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {isBase && (
            <img
              src={productArt}
              alt={snap?.name ?? line.item?.name}
              className="h-12 w-14 rounded-lg bg-white object-contain"
            />
          )}
          <div>
            {isBase && (
              <span className="rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-[9px] font-bold text-secondary">
                BASE SYSTEM
              </span>
            )}
            <p className="font-bold">
              {snap?.name ?? line.item?.name ?? line.customLabel ?? line.sku}
            </p>
            <p className="text-xs text-on-surface-variant">
              {snap?.sku ?? line.sku ?? "CUSTOM SURCHARGE"}{" "}
              {snap?.costStatus && snap.costStatus !== "ACTIVE" && (
                <b
                  className={
                    snap.costStatus === "MISSING"
                      ? "text-error"
                      : "text-amber-700"
                  }
                >
                  {snap.costStatus}
                </b>
              )}
            </p>
          </div>
        </div>
      </td>
      <td className="text-center">
        <input
          aria-label={`Quantity ${index + 1}`}
          type="number"
          min="1"
          value={line.qty}
          onChange={(e) =>
            patch(line.key, { qty: Math.max(1, Number(e.target.value)) })
          }
          className="w-12 bg-transparent text-center"
        />
      </td>
      <td className="text-right">
        <span
          title={
            snap?.costSnapshot
              ? `${snap.costSnapshot.priceSource} · ${snap.costSnapshot.effectiveFrom}–${snap.costSnapshot.effectiveTo}`
              : "Supplier cost unavailable"
          }
        >
          {rmbFen(snap?.unitCostFen)}
        </span>
        {delta ? (
          <small
            className={`block ${delta > 0 ? "text-error" : "text-emerald-700"}`}
          >
            {delta > 0 ? "+" : "−"}
            {rmbFen(Math.abs(delta))}
          </small>
        ) : null}
      </td>
      <td className="text-right font-mono">
        {usd(snap?.suggestedUnitUsdCents ?? line.surchargeUsdCents)}
      </td>
      <td className="text-right">
        {editing === line.key ? (
          <div>
            <input
              autoFocus
              aria-label={`Actual price ${index + 1}`}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => onEditKey(e, line.key)}
              onBlur={() => commitEdit(line.key)}
              className="w-28 rounded-lg border border-secondary px-2 py-1 text-right font-mono"
            />
            <small className="block whitespace-nowrap text-secondary">
              Row margin {marginPct(before)} → {marginPct(after)}
            </small>
          </div>
        ) : (
          <button
            aria-label={`Edit actual price ${index + 1}`}
            onClick={() => openEdit(line)}
            className="font-mono font-bold"
          >
            {usd(actual)}{" "}
            <span className="material-symbols-outlined align-middle text-sm">
              edit
            </span>
          </button>
        )}
      </td>
      <td className="text-right font-bold">
        {marginPct(marginFor(actual, snap?.unitCostUsdCents))}
      </td>
      <td data-testid="quote-share" className="px-4 text-right font-bold">
        {formatShare(share)}
      </td>
    </tr>
  );
}
const formatShare = (share: number | null | undefined) =>
  share == null ? "—" : `${share}%`;
function CustomDialog({
  label,
  value,
  setLabel,
  setValue,
  add,
  close,
}: {
  label: string;
  value: string;
  setLabel: (v: string) => void;
  setValue: (v: string) => void;
  add: () => void;
  close: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/30"
    >
      <div className="w-96 rounded-xl bg-surface p-5 shadow-xl">
        <h2 className="font-headline text-lg font-black">Custom item</h2>
        <label className="mt-4 block text-sm font-bold">
          Label
          <input
            aria-label="Custom item label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border p-2"
          />
        </label>
        <label className="mt-3 block text-sm font-bold">
          USD value
          <input
            aria-label="Custom item value"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-lg border p-2"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={close}>Cancel</button>
          <button
            onClick={add}
            className="rounded-lg bg-primary px-4 py-2 text-on-primary"
          >
            Add custom item
          </button>
        </div>
      </div>
    </div>
  );
}
function ValidationDrawer({
  issues,
  close,
}: {
  issues: DraftLine[];
  close: () => void;
}) {
  return (
    <>
      <button
        aria-label="Close validation"
        onClick={close}
        className="fixed inset-0 z-40 bg-black/20"
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-[min(24rem,90vw)] overflow-auto border-l bg-surface p-5 shadow-xl">
        <button
          onClick={close}
          aria-label="Close validation panel"
          className="float-right"
        >
          ✕
        </button>
        <h2 className="font-headline text-lg font-black">Validation</h2>
        {issues.length ? (
          issues.map((line) => (
            <div
              key={line.key}
              className="mt-4 rounded-xl border border-error/25 p-4"
            >
              <p className="font-bold">{line.snapshot?.name}</p>
              <p className="text-sm text-error">
                {line.snapshot?.costStatus === "MISSING"
                  ? "Supplier cost is missing or unavailable."
                  : "Supplier price expires soon."}
              </p>
            </div>
          ))
        ) : (
          <p className="mt-4 text-sm text-on-surface-variant">
            No issues requiring attention.
          </p>
        )}
      </aside>
    </>
  );
}
function Summary({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface px-5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <p
        className={`mt-1 font-headline text-xl font-black ${
          accent ? "text-secondary" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
