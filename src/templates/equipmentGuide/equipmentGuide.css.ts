export const equipmentGuideCss = `
  @page { size: Letter; margin: 0.6in 0.6in 0.7in 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, h3, .series-title, .cover-title { font-family: 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0 0 8px; }
  .page { break-after: page; padding-top: 4px; }
  .page:last-child { break-after: auto; }
  .page--product { display: flex; flex-direction: column; min-height: 9.1in; }
  .page-foot { margin-top: auto; border-top: 1px solid #eef2f7; }
  .brandbar { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 20px; }
  .brandbar .site { color: #64748b; font-size: 12px; }
  .brand-logo { height: 30px; width: auto; }
  .section-accent { width: 40px; height: 3px; background: #0284c7; border-radius: 2px; margin: 6px 0 10px; }
  .eyebrow { color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
  .series-title { color: #1e3a5f; font-size: 26px; font-weight: 700; margin: 6px 0 14px; }
  section[data-category="plasma-etch"] .eyebrow { color: #0066cc; }
  section[data-category="plasma-etch"] .section-accent { background: #0066cc; }
  section[data-category="thin-film"] .eyebrow { color: #022448; }
  section[data-category="thin-film"] .section-accent { background: #022448; }
  section[data-category="litho-surface"] .eyebrow { color: #0d7ea8; }
  section[data-category="litho-surface"] .section-accent { background: #0d7ea8; }
  .product-head { display: flex; gap: 20px; align-items: flex-start; }
  .product-copy { flex: 1 1 55%; }
  .image-well { flex: 0 0 215px; height: 200px; padding: 14px; border: 1px solid #eef2f7; border-radius: 10px; box-shadow: 0 6px 24px rgba(15,23,42,0.06); background: linear-gradient(180deg, #ffffff 0%, #f4f6f9 100%); display: flex; align-items: center; justify-content: center; }
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
  .ev-sub { color: #334155; font-size: 13px; margin: 0 0 14px; max-width: 66ch; }
  .study { break-inside: avoid; background: #f8fafc; border: 1px solid #e8edf3; border-left: 3px solid #0284c7; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; }
  .study .j, .study .y { color: #0284c7; font-weight: 700; font-size: 12.5px; letter-spacing: .06em; text-transform: uppercase; }
  .study .t { color: #0f172a; font-weight: 600; font-size: 13px; margin-top: 3px; }
  .study .m { color: #64748b; font-size: 11.5px; margin-top: 2px; }
  .study .m .doi { color: #0284c7; font-size: 11.5px; text-decoration: none; }
  .disclaimer { color: #64748b; font-size: 11px; margin-top: 12px; font-style: italic; }
  .pillars-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .pillar-card { break-inside: avoid; background: #f4f5fb; border: 1px solid #e7e9f4; border-radius: 10px; padding: 12px 14px; }
  .pillar-card .pi { color: #1e3a5f; display: inline-block; width: 18px; height: 18px; margin-bottom: 4px; }
  .pillar-card .pi svg { width: 18px; height: 18px; }
  .pillar-card .h { display: block; font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 13px; color: #1e3a5f; margin-bottom: 3px; }
  .pillar-card div { font-size: 12.5px; color: #334155; }
  .cta-band { display: flex; flex-direction: column; gap: 4px; background: #0f2440; color: #fff; border-radius: 10px; padding: 16px 18px; margin: 4px 0 18px; -webkit-print-color-adjust: exact; }
  .cta-band-h { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 14px; }
  .cta-band .sub { font-size: 11px; font-weight: 400; color: #9fb3cc; letter-spacing: .01em; }
  .apps, .cta, .cta-band { break-inside: avoid; }
  .page--contact { display: flex; flex-direction: column; min-height: 9.1in; }
  .page--contact .page-foot { margin-top: 8px; }
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .contact-card .h { text-transform: uppercase; letter-spacing: .08em; font-size: 12.5px; }
  .contact-card p { margin: 0 0 4px; font-size: 12.5px; color: #334155; }
  .footer-bar { margin-top: auto; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #eef2f7; padding-top: 10px; margin-bottom: 6px; font-size: 12.5px; color: #64748b; }
  .fb-left { display: inline-flex; align-items: center; gap: 8px; color: #1e3a5f; font-weight: 600; }
  .fb-logo { height: 20px; width: auto; }
  .fb-right { display: inline-flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 2px; }
  .fb-slogan { font-size: 10px; letter-spacing: .04em; text-transform: uppercase; color: #94a3b8; }
  .family { color: #334155; font-size: 12.5px; margin-top: 8px; }
  .lead { font-size: 13px; color: #334155; margin: 0 0 14px; }
  .apps { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: #f7f9fc; border: 1px solid #eef2f7; }
  .apps .lab { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; color: #8a97a6; margin: 0 0 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 12.5px; font-weight: 600; color: #1e3a5f; background: #fff; border: 1px solid #e6ebf1; border-radius: 999px; padding: 3px 10px; }
  .cta { margin-top: 12px; display: flex; align-items: center; gap: 12px; }
  .cta .btn { display: inline-flex; align-items: center; gap: 7px; text-decoration: none; background: #0284c7; color: #fff; font-weight: 700; font-size: 12.5px; padding: 8px 14px; border-radius: 8px; white-space: nowrap; }
  .cta-url { font-size: 12.5px; color: #64748b; letter-spacing: .01em; white-space: nowrap; }
  .page--cover { display: flex; flex-direction: column; min-height: 9.1in; }
  .cover-main { margin-top: 90px; }
  .cover-title { font-size: 46px; letter-spacing: -0.01em; margin: 4px 0 10px; }
  .cover-tagline { font-size: 14px; color: #334155; max-width: 58ch; }
  .cover-edition { font-size: 11px; color: #64748b; letter-spacing: .06em; margin-top: 12px; }
  .toc { display: flex; gap: 28px; margin-top: auto; padding-top: 24px; border-top: 1px solid #eef2f7; }
  .toc-col { flex: 1; }
  .toc-cat { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; border-bottom: 2px solid; padding-bottom: 5px; margin-bottom: 8px; }
  .toc ul { list-style: none; margin: 0; padding: 0; }
  .toc li { display: flex; align-items: flex-end; font-size: 12.5px; color: #0f172a; padding: 3px 0; }
  .toc-name { flex: 0 1 auto; }
  .toc-dots { flex: 1 1 auto; min-width: 10px; border-bottom: 1px dotted #b6c2d2; margin: 0 6px 4px; }
  .toc-page { flex: 0 0 auto; color: #475569; font-size: 11px; font-variant-numeric: tabular-nums; }
  .toc-front { display: flex; flex-wrap: wrap; gap: 6px 20px; margin-top: 14px; padding-top: 10px; border-top: 1px solid #eef2f7; font-size: 11px; color: #64748b; }
  .toc-front b { color: #475569; font-weight: 600; }
  /* e-beam: 10-row spec table + 4 wrapping app chips — tighten locally to hold one page */
  section[data-product-id="e-beam"] td, section[data-product-id="e-beam"] th { padding-top: 4px; padding-bottom: 4px; }
  section[data-product-id="e-beam"] .apps { margin-top: 8px; padding: 7px 12px; }
  section[data-product-id="e-beam"] .cta { margin-top: 8px; }
  /* plasma-cleaner carries the guide's densest spec table — tighten locally to hold one page */
  section[data-product-id="plasma-cleaner"] td, section[data-product-id="plasma-cleaner"] th { padding-top: 4px; padding-bottom: 4px; }
  section[data-product-id="plasma-cleaner"] .apps { margin-top: 8px; padding: 7px 12px; }
  section[data-product-id="plasma-cleaner"] .cta { margin-top: 8px; }
  section[data-product-id="plasma-cleaner"] .image-well { height: 170px; }
`;
