export const equipmentGuideCss = `
  @page { size: Letter; margin: 0.6in 0.6in 0.7in 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, h3 { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; margin: 0 0 8px; }
  .page { break-after: page; padding-top: 4px; }
  .page:last-child { break-after: auto; }
  .page--product { display: flex; flex-direction: column; min-height: 9.1in; }
  .page-foot { margin-top: auto; border-top: 1px solid #eef2f7; }
  .brandbar { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 20px; }
  .brandbar .site { color: #64748b; font-size: 12px; }
  .brandbar--dark { border-bottom: 1px solid rgba(255,255,255,0.14); }
  .brandbar--dark .site { color: #cbd5e1; }
  .brand-logo { height: 30px; width: auto; }
  .section-accent { width: 40px; height: 3px; background: #0284c7; border-radius: 2px; margin: 6px 0 10px; }
  .eyebrow { color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
  .series-title { color: #1e3a5f; font-size: 28px; margin: 6px 0 14px; }
  .product-head { display: flex; gap: 20px; align-items: flex-start; }
  .product-copy { flex: 1 1 55%; }
  .image-well { flex: 0 0 42%; height: 200px; padding: 14px; border: 1px solid #eef2f7; border-radius: 10px; box-shadow: 0 6px 24px rgba(15,23,42,0.06); background: linear-gradient(180deg, #ffffff 0%, #f4f6f9 100%); display: flex; align-items: center; justify-content: center; }
  .image-well img { object-fit: contain; max-width: 100%; max-height: 100%; }
  .bullet { break-inside: avoid; margin-bottom: 6px; }
  .bullet .h { color: #0369a1; font-weight: 700; font-size: 13px; }
  .bullet .b { color: #334155; font-size: 12.5px; }
  .spec-table { margin-top: 12px; border: 1px solid #e8edf3; border-radius: 8px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; break-inside: auto; }
  th { background: #1e3a5f; color: #fff; text-align: left; font-size: 12.5px; padding: 7px 14px; letter-spacing: 0.04em; text-transform: uppercase; }
  td { border-bottom: 1px solid #eef2f7; font-size: 12.5px; padding: 6px 14px; vertical-align: top; }
  td.label { width: 34%; color: #0f172a; font-weight: 600; background: #f5f8fc; }
  tr:nth-child(even) td:not(.label) { background: #fafbfc; }
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
  .family { color: #334155; font-size: 12.5px; margin-top: 8px; }
  .lead { font-size: 13px; color: #334155; margin: 0 0 12px; max-width: 52ch; }
  .apps { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: #f7f9fc; border: 1px solid #eef2f7; }
  .apps .lab { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; color: #8a97a6; margin: 0 0 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 12.5px; font-weight: 600; color: #1e3a5f; background: #fff; border: 1px solid #e6ebf1; border-radius: 999px; padding: 3px 10px; }
  .cta { margin-top: 12px; }
  .cta .btn { display: inline-flex; align-items: center; gap: 7px; text-decoration: none; background: #0284c7; color: #fff; font-weight: 700; font-size: 12.5px; padding: 8px 14px; border-radius: 8px; }
`;
