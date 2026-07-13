import type { SpecEntry } from '../../data/probeStations/semishare';

interface SourcedSpecTableProps {
  specs: readonly SpecEntry[];
  caption: string;
}

export function SourcedSpecTable({ specs, caption }: SourcedSpecTableProps) {
  if (specs.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Detailed specifications on request — contact us and we will confirm the
        exact configuration for your application with the manufacturer.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th scope="col" className="py-2 pr-4 font-semibold text-slate-900">Specification</th>
            <th scope="col" className="py-2 font-semibold text-slate-900">Value</th>
          </tr>
        </thead>
        <tbody>
          {specs.map((spec) => (
            <tr key={spec.label} className="border-b border-slate-100">
              {/* spec.source stays in the data module as the audit trail; it is
                  deliberately NOT rendered — per-row outbound OEM links leaked
                  visitors to the manufacturer and read as second-hand data. */}
              <td className="py-2 pr-4 text-slate-700">{spec.label}</td>
              <td className="py-2 text-slate-900">{spec.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Specifications from manufacturer public materials; subject to OEM confirmation.
      </p>
    </div>
  );
}
