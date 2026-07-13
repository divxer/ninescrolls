import { useEffect, useState } from 'react';
import { fetchPublishedEvidence } from '../../services/evidenceService';
import { countEvidenceByType, EvidenceTypeCount } from '../../config/evidence';

interface ProductEvidenceProps {
  productSlug: string;
}

// Explicit plural map — naive "+s" would produce "Case Studys"/"Process Validations".
const PLURALS: Record<string, string> = {
  'Application Note': 'Application Notes',
  'Process Note': 'Process Notes',
  'Technical Note': 'Technical Notes',
  'Published Research': 'Published Research',
  'Case Study': 'Case Studies',
  'Process Validation': 'Process Validation',
};
function labelFor(group: EvidenceTypeCount): string {
  return group.count === 1 ? group.label : (PLURALS[group.label] ?? `${group.label}s`);
}

/**
 * Phase 1 product-page Evidence module. Signals "this product has verifiable
 * evidence" via grouped-by-type counts. Display-only — no links, no expand.
 * Renders nothing when the product has no published evidence.
 */
export function ProductEvidence({ productSlug }: ProductEvidenceProps) {
  const [groups, setGroups] = useState<EvidenceTypeCount[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublishedEvidence(productSlug).then((records) => {
      if (active) setGroups(countEvidenceByType(records));
    });
    return () => { active = false; };
  }, [productSlug]);

  if (!groups || groups.length === 0) return null;

  return (
    <section data-testid="product-evidence" className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
      <div className="mx-auto max-w-screen-2xl">
        <h2 className="font-headline text-4xl font-semibold tracking-normal text-slate-950">Evidence</h2>
        <ul className="mt-8 flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.type} className="flex items-center gap-3 text-lg text-slate-800">
              <span aria-hidden className="text-sky-600">✓</span>
              <span className="font-semibold">{group.count} {labelFor(group)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
