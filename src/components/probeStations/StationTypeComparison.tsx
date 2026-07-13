// Cell texts mirror the automation-levels figure — qualitative dimensions only,
// no throughput or wafer-size claims (they are configuration-dependent).
const ROWS = [
  {
    aspect: 'Positioning',
    manual: 'Hand-driven micropositioners',
    semi: 'Motorized stage with manual probe setup',
    auto: 'Programmed wafer mapping and alignment',
  },
  {
    aspect: 'Workflow',
    manual: 'Device-by-device measurement',
    semi: 'Recipe-assisted multi-site stepping',
    auto: 'Automated wafer-map execution',
  },
  {
    aspect: 'Best fit',
    manual: 'Exploratory research, teaching, flexible setups',
    semi: 'R&D characterization and repeated measurements',
    auto: 'High-volume mapping and production-style test',
  },
  {
    aspect: 'Operator involvement',
    manual: 'Continuous hands-on control',
    semi: 'Setup plus supervision',
    auto: 'Exception handling and run oversight',
  },
] as const;

export function StationTypeComparison() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Manual vs semi-automatic vs fully automatic probe stations</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 pr-4 font-semibold text-slate-900"><span className="sr-only">Aspect</span></th>
            <th className="py-2 pr-4 font-semibold text-slate-900">Manual</th>
            <th className="py-2 pr-4 font-semibold text-slate-900">Semi-automatic</th>
            <th className="py-2 font-semibold text-slate-900">Fully automatic</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.aspect} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-medium text-slate-900">{row.aspect}</td>
              <td className="py-2 pr-4 text-slate-700">{row.manual}</td>
              <td className="py-2 pr-4 text-slate-700">{row.semi}</td>
              <td className="py-2 text-slate-700">{row.auto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
