import { describe, expect, it } from "vitest";
import { isQuotationFixtureUrl } from "../../pages/admin/quotationFixtureGate";

describe("AdminRoute fixture gate", () => {
  it("only accepts the exact new-quotation fixture URL in development", () => {
    expect(isQuotationFixtureUrl("/admin/quotations/new", "?fixture=1", true)).toBe(true);
    expect(isQuotationFixtureUrl("/admin/quotations/new", "?fixture=1", false)).toBe(false);
    expect(isQuotationFixtureUrl("/admin/quotations/Q-1", "?fixture=1", true)).toBe(false);
    expect(isQuotationFixtureUrl("/admin/quotations/new", "?fixture=1&extra=1", true)).toBe(false);
    expect(isQuotationFixtureUrl("/admin/quotations/new", "", true)).toBe(false);
  });
});
