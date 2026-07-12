interface SchematicFigureProps {
  /** Extension-less base path, e.g. "/assets/images/insights/probe-station-anatomy".
   *  Responsive variants (-sm/-md/-lg/-xl .webp + -lg.png fallback) are derived from it. */
  srcBase: string;
  alt: string;
  caption: string;
}

export function SchematicFigure({ srcBase, alt, caption }: SchematicFigureProps) {
  return (
    <figure className="my-6">
      <picture>
        <source srcSet={`${srcBase}-xl.webp`} media="(min-width: 1280px)" type="image/webp" />
        <source srcSet={`${srcBase}-lg.webp`} media="(min-width: 1024px)" type="image/webp" />
        <source srcSet={`${srcBase}-md.webp`} media="(min-width: 768px)" type="image/webp" />
        <source srcSet={`${srcBase}-sm.webp`} media="(max-width: 767px)" type="image/webp" />
        <img src={`${srcBase}-lg.png`} alt={alt} loading="lazy" className="w-full rounded-xl border border-slate-200" />
      </picture>
      <figcaption className="mt-2 text-xs text-slate-500">
        {caption} — Schematic illustration, not actual product appearance.
      </figcaption>
    </figure>
  );
}
