export const equipmentGuideCss = `
  @page { size: Letter; margin: 0.6in 0.6in 0.7in 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, h3 { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; margin: 0 0 8px; }
  .page { break-after: page; padding-top: 4px; }
  .page:last-child { break-after: auto; }
  .brandbar { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 20px; }
  .brandbar .site { color: #64748b; font-size: 12px; }
  .eyebrow { color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
  .series-title { color: #1e3a5f; font-size: 28px; margin: 6px 0 14px; }
  .product-head { display: flex; gap: 20px; align-items: flex-start; }
  .product-copy { flex: 1 1 55%; }
  .product-img { flex: 0 0 42%; text-align: center; }
  .product-img img { max-width: 100%; height: auto; border-radius: 8px; background: #f4f5f7; padding: 8px; }
  .bullet { break-inside: avoid; margin-bottom: 8px; }
  .bullet .h { color: #0369a1; font-weight: 700; font-size: 13px; }
  .bullet .b { color: #334155; font-size: 12.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; break-inside: auto; }
  th { background: #1e3a5f; color: #fff; text-align: left; font-size: 12.5px; padding: 8px 12px; }
  td { border-bottom: 1px solid #e2e8f0; font-size: 12.5px; padding: 8px 12px; vertical-align: top; }
  td.label { width: 34%; color: #0f172a; font-weight: 600; background: #f8fafc; }
  tr { break-inside: avoid; }
  .evidence { background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 22px; }
  .evidence h1 { color: #fff; font-size: 26px; }
  .evidence .sub { color: #cbd5e1; font-size: 13px; margin-bottom: 14px; }
  .study { border-top: 1px solid #1e293b; padding: 10px 0; }
  .study .j { color: #7dd3fc; font-weight: 700; font-size: 13px; }
  .study .t { color: #f1f5f9; font-size: 13px; }
  .study .m { color: #94a3b8; font-size: 11.5px; }
  .disclaimer { color: #94a3b8; font-size: 11px; margin-top: 12px; font-style: italic; }
  .pillar { break-inside: avoid; margin-bottom: 10px; }
  .pillar .h { color: #0369a1; font-weight: 700; }
  .family { color: #334155; font-size: 12.5px; margin-top: 10px; }
`;
