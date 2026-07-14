export const isQuotationFixtureUrl = (
  pathname: string,
  search: string,
  dev = import.meta.env.DEV
) => dev && pathname === "/admin/quotations/new" && search === "?fixture=1";
