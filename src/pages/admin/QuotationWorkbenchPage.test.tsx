import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateLineInputs } from "../../../amplify/functions/price-api/resolvers/quotationResolvers";

const {
  createQuotationDraft,
  updateQuotationDraft,
  getQuotation,
  listCatalogItems,
  snapshot,
} = vi.hoisted(() => {
  const machine = {
    itemId: "machine",
    sku: "RIE-300",
    name: "ICP-RIE Advanced",
    series: "RIE",
    kind: "MACHINE" as const,
    requiredOptionSkus: [],
    requiresSkus: [],
    excludesSkus: [],
    createdAt: "T",
    updatedAt: "T",
  };
  const option = {
    itemId: "option",
    sku: "OPT-BIAS",
    name: "RF Bias Module",
    series: "RIE",
    kind: "OPTION" as const,
    specs: { supplierCode: "PB-42" },
    requiredOptionSkus: [],
    requiresSkus: [],
    excludesSkus: [],
    createdAt: "T",
    updatedAt: "T",
  };
  const service = {
    itemId: "service",
    sku: "SVC-INSTALL",
    name: "Commissioning Visit",
    series: "FIELD",
    kind: "SERVICE" as const,
    requiredOptionSkus: [],
    requiresSkus: [],
    excludesSkus: [],
    createdAt: "T",
    updatedAt: "T",
  };
  const line = (
    item: typeof machine | typeof option | typeof service,
    lineNo: number,
    overrides = {}
  ) => ({
    lineNo,
    itemId: item.itemId,
    sku: item.sku,
    name: item.name,
    series: item.series,
    kind: item.kind,
    qty: 1,
    lineType: "NORMAL" as const,
    unitCostFen: 72500000 as number | null,
    previousUnitCostFen: 75000000,
    costDeltaFen: -2500000 as number | null,
    costStatus: "ACTIVE" as "ACTIVE" | "EXPIRING" | "MISSING",
    costSnapshot: {
      supplierId: "SUP-1",
      unitCostFen: 72500000,
      currency: "RMB",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
      priceSource: "SUPPLIER_EXCEL",
      reviewStatus: "APPROVED",
    },
    fxRmbPerUsdMilli: 7250,
    marginBpApplied: 3750,
    unitCostUsdCents: 100000,
    suggestedUnitUsdCents: 160000,
    actualUnitUsdCents: 160000,
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
    actualLineTotalUsdCents: 160000,
    ...overrides,
  });
  const snapshot = {
    quotationNumber: "Q-2026-0009",
    version: 1,
    revision: 1,
    status: "DRAFT" as const,
    schemeLabel: "Standard",
    customerName: "MIT Nano",
    validUntil: "2026-12-31",
    totalCostUsdCents: 200000,
    suggestedTotalUsdCents: 320000,
    actualTotalUsdCents: 320000,
    actualMarginBp: 3750,
    belowMinMargin: false,
    incomplete: false,
    lineCount: 2,
    createdAt: "T",
    updatedAt: "T",
    lines: [line(machine, 1), line(option, 2)],
  };
  return {
    snapshot,
    createQuotationDraft: vi.fn(async () => snapshot),
    updateQuotationDraft: vi.fn(async () => ({ ...snapshot, revision: 2 })),
    getQuotation: vi.fn(async () => ({ scheme: null, versions: [snapshot] })),
    listCatalogItems: vi.fn(async () => ({
      items: [machine, option, service],
    })),
  };
});

vi.mock("../../services/priceAdminService", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/priceAdminService")
  >("../../services/priceAdminService");
  return {
    ...actual,
    createQuotationDraft,
    updateQuotationDraft,
    getQuotation,
    listCatalogItems,
  };
});

import { QuotationWorkbenchPage } from "./QuotationWorkbenchPage";
function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}
const renderPage = (path = "/admin/quotations/new") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route
          path="/admin/quotations/new"
          element={<QuotationWorkbenchPage />}
        />
        <Route
          path="/admin/quotations/:quotationNumber"
          element={<QuotationWorkbenchPage />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("QuotationWorkbenchPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates once, replaces the URL, then updates the same quotation", async () => {
    renderPage();
    fireEvent.change(await screen.findByPlaceholderText("Customer name"), {
      target: { value: "MIT Nano" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() => expect(createQuotationDraft).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/admin/quotations/Q-2026-0009"
    );
    fireEvent.click(screen.getByRole("button", { name: /saved|save draft/i }));
    await waitFor(() => expect(updateQuotationDraft).toHaveBeenCalledTimes(1));
    expect(createQuotationDraft).toHaveBeenCalledTimes(1);
  });

  it("loads the development fixture without calling quotation services", async () => {
    renderPage("/admin/quotations/new?fixture=1");

    expect(await screen.findByDisplayValue("Caltech Kavli Nanoscience Institute")).toBeInTheDocument();
    expect(screen.getByText("ICP-RIE 300 Advanced Platform")).toBeInTheDocument();
    expect(screen.getByText("EXPIRING")).toBeInTheDocument();
    expect(screen.getByText("MISSING")).toBeInTheDocument();
    expect(screen.getAllByText(/\+¥/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$852,500.00").length).toBeGreaterThan(0);
    expect(listCatalogItems).not.toHaveBeenCalled();
    expect(getQuotation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByRole("button", { name: /saved/i })).toBeEnabled();
    expect(createQuotationDraft).not.toHaveBeenCalled();
    expect(updateQuotationDraft).not.toHaveBeenCalled();
  });

  it("shows saving and saved feedback around a successful save", async () => {
    let release!: (value: typeof snapshot) => void;
    createQuotationDraft.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    renderPage();
    await screen.findByPlaceholderText("Customer name");
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(screen.getByRole("button", { name: /Saving/i })).toBeDisabled();
    release(snapshot);
    expect(await screen.findByRole("button", { name: /Saved/i })).toBeEnabled();
  });

  it("reconciles server reordered lines and authoritative prices after every save", async () => {
    const reversed = {
      ...snapshot,
      revision: 2,
      actualTotalUsdCents: 333300,
      lines: [
        {
          ...snapshot.lines[1],
          lineNo: 1,
          actualUnitUsdCents: 173300,
          actualLineTotalUsdCents: 173300,
        },
        { ...snapshot.lines[0], lineNo: 2 },
      ],
    };
    updateQuotationDraft.mockResolvedValueOnce(reversed);
    renderPage("/admin/quotations/Q-2026-0009");
    await screen.findByText("RF Bias Module");
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(await screen.findByText("$1,733.00")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("RF Bias Module");
    expect(rows[2]).toHaveTextContent("ICP-RIE Advanced");
  });

  it("filters by supplier code and adds the explicitly selected catalog result", async () => {
    renderPage();
    const search = await screen.findByRole("searchbox", {
      name: /catalog search/i,
    });
    await userEvent.type(search, "PB-42");
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /RF Bias Module.*OPT-BIAS/i })
    );
    expect(
      screen.getByRole("row", { name: /RF Bias Module/ })
    ).toBeInTheDocument();
    expect(screen.queryByText("ICP-RIE Advanced")).not.toBeInTheDocument();
  });

  it("adds an explicit machine base and an honest custom surcharge", async () => {
    renderPage();
    await screen.findByPlaceholderText("Customer name");
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Machine.*ICP-RIE Advanced/i })
    );
    expect(screen.getByText("BASE SYSTEM")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Custom$/i }));
    fireEvent.change(screen.getByLabelText(/custom item label/i), {
      target: { value: "Special crating" },
    });
    fireEvent.change(screen.getByLabelText(/custom item value/i), {
      target: { value: "425.50" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add custom item/i }));
    expect(screen.getAllByText("Special crating").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    await waitFor(() =>
      expect(createQuotationDraft).toHaveBeenCalled()
    );
    const payload = (createQuotationDraft.mock.calls as unknown as Array<[{ lines: unknown[] }]>)[0]?.[0];
    expect(payload?.lines[1]).toEqual({
      sku: "Special crating",
      qty: 1,
      lineType: "SURCHARGE",
      surchargeUsdCents: 42550,
      actualUnitUsdCents: 42550,
      overrideReason: "Special crating",
    });
    expect(() => validateLineInputs(payload?.lines as Parameters<typeof validateLineInputs>[0])).not.toThrow();
  });

  it("Option+O and Option+S filter by catalog kind, with explicit kind actions", async () => {
    renderPage();
    await screen.findByPlaceholderText("Customer name");

    fireEvent.keyDown(window, { key: "o", altKey: true });
    expect(screen.getByRole("menuitem", { name: /RF Bias Module/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Commissioning Visit/i })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "s", altKey: true });
    expect(screen.getByRole("menuitem", { name: /Commissioning Visit/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /RF Bias Module/i })).not.toBeInTheDocument();

    expect(screen.getByRole("menuitem", { name: /^Option$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Service$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Custom$/i })).toBeInTheDocument();
  });

  it("Escape cancels without blur commit; Enter commits; Tab commits and opens next cell", async () => {
    renderPage("/admin/quotations/Q-2026-0009");
    const edits = await screen.findAllByRole("button", {
      name: /edit actual price/i,
    });
    fireEvent.click(edits[0]);
    let input = screen.getByRole("textbox", { name: /actual price 1/i });
    fireEvent.change(input, { target: { value: "1400" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getAllByText("$1,600.00").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole("button", { name: /edit actual price/i })[0]
    );
    input = screen.getByRole("textbox", { name: /actual price 1/i });
    fireEvent.change(input, { target: { value: "1500" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: /edit actual price/i })[0]
    );
    input = screen.getByRole("textbox", { name: /actual price 1/i });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(
      screen.getByRole("textbox", { name: /actual price 2/i })
    ).toHaveFocus();
  });

  it("uses coherent unsaved totals and deterministic shares that sum to 100", async () => {
    renderPage("/admin/quotations/Q-2026-0009");
    const qty = await screen.findByRole("spinbutton", { name: /Quantity 1/i });
    fireEvent.change(qty, { target: { value: "2" } });
    expect(screen.getByText(/Unsaved preview/i)).toBeInTheDocument();
    expect(screen.getAllByText("$4,800.00").length).toBeGreaterThan(0);
    const body = screen
      .getAllByRole("row")
      .slice(1, 3)
      .map((row) => within(row).getByTestId("quote-share").textContent);
    expect(body).toEqual(["67%", "33%"]);
    const edits = screen.getAllByRole("button", { name: /edit actual price/i });
    fireEvent.click(edits[0]);
    const input = screen.getByRole("textbox", { name: /actual price 1/i });
    fireEvent.change(input, { target: { value: "1400" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("31.8%")).toBeInTheDocument();
  });

  it("preserves unknown authoritative and preview totals instead of understating them", async () => {
    getQuotation.mockResolvedValueOnce({
      scheme: null,
      versions: [{
        ...snapshot,
        totalCostUsdCents: null,
        suggestedTotalUsdCents: null,
        actualTotalUsdCents: null,
        actualMarginBp: null,
        incomplete: true,
        lines: [
          snapshot.lines[0],
          { ...snapshot.lines[1], unitCostUsdCents: null, suggestedUnitUsdCents: null, actualUnitUsdCents: null, actualLineTotalUsdCents: null },
        ],
      }],
    } as never);
    renderPage("/admin/quotations/Q-2026-0009");
    await screen.findByText("RF Bias Module");
    const summaries = screen.getAllByText("—");
    expect(summaries.length).toBeGreaterThanOrEqual(4);
    fireEvent.change(screen.getByRole("spinbutton", { name: /Quantity 1/i }), { target: { value: "2" } });
    expect(screen.getByText(/Unsaved preview/i)).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("allows only one machine and prevents adding duplicate catalog items", async () => {
    renderPage();
    await screen.findByPlaceholderText("Customer name");
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Machine.*ICP-RIE Advanced/i }));
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    expect(screen.queryByRole("menuitem", { name: /Machine.*ICP-RIE Advanced/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /RF Bias Module/i }));
    fireEvent.click(screen.getByRole("button", { name: /add item/i }));
    expect(screen.queryByRole("menuitem", { name: /RF Bias Module/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("BASE SYSTEM")).toHaveLength(1);
  });

  it("keeps historical duplicate rows independently editable and labels only the first machine as base", async () => {
    getQuotation.mockResolvedValueOnce({
      scheme: null,
      versions: [{ ...snapshot, lines: [snapshot.lines[0], { ...snapshot.lines[0], lineNo: 2 }] }],
    });
    renderPage("/admin/quotations/Q-2026-0009");
    expect(await screen.findAllByText("ICP-RIE Advanced")).toHaveLength(2);
    expect(screen.getAllByText("BASE SYSTEM")).toHaveLength(1);
    fireEvent.change(screen.getByRole("spinbutton", { name: /Quantity 2/i }), { target: { value: "3" } });
    expect(screen.getByRole("spinbutton", { name: /Quantity 1/i })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: /Quantity 2/i })).toHaveValue(3);
  });

  it("shows validity context, line abnormal states, signed deltas, and line details in an overlay", async () => {
    getQuotation.mockResolvedValueOnce({
      scheme: null,
      versions: [
        {
          ...snapshot,
          incomplete: true,
          lines: [
            {
              ...snapshot.lines[0],
              costStatus: "EXPIRING",
              costDeltaFen: -2500000,
            },
            {
              ...snapshot.lines[1],
              costStatus: "MISSING",
              unitCostFen: null,
              costDeltaFen: null,
            },
          ],
        },
      ],
    });
    renderPage("/admin/quotations/Q-2026-0009");
    expect(await screen.findByLabelText(/Valid until/i)).toHaveValue(
      "2026-12-31"
    );
    expect(screen.getByText("EXPIRING")).toBeInTheDocument();
    expect(screen.getByText("MISSING")).toBeInTheDocument();
    expect(screen.getByText(/−¥25,000.00/)).not.toHaveClass("text-error");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Validation \(2\)/i }));
    const drawer = screen.getByRole("complementary");
    expect(drawer).toHaveClass("fixed");
    expect(drawer).toHaveTextContent("ICP-RIE Advanced");
    expect(drawer).toHaveTextContent("RF Bias Module");
  });

  it("renders the supported P1 cap of 45 lines", async () => {
    const lines = Array.from({ length: 45 }, (_, i) => ({
      ...snapshot.lines[1],
      lineNo: i + 1,
      itemId: `option-${i}`,
      sku: `OPT-${i}`,
      name: `Option ${i}`,
    }));
    getQuotation.mockResolvedValueOnce({
      scheme: null,
      versions: [{ ...snapshot, lineCount: 45, lines }],
    });
    renderPage("/admin/quotations/Q-2026-0009");
    expect(await screen.findByText("Option 44")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /edit actual price/i })
    ).toHaveLength(45);
  });
});
