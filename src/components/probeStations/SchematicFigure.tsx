interface SchematicFigureProps {
  src: string;
  alt: string;
  caption: string;
}

export function SchematicFigure({ src, alt, caption }: SchematicFigureProps) {
  return (
    <figure className="my-6">
      <img src={src} alt={alt} loading="lazy" className="w-full rounded-xl border border-slate-200" />
      <figcaption className="mt-2 text-xs text-slate-500">
        {caption} — Schematic illustration, not actual product appearance.
      </figcaption>
    </figure>
  );
}
