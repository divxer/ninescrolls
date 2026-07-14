/** Total-override allocation (spec: "Manual overrides"). Integer minor units. */

export interface AllocLine {
  sku: string;
  lineType: 'NORMAL' | 'SURCHARGE';
  suggestedLineTotalUsdCents: number | null;
}

export interface AllocatedLine extends AllocLine {
  actualLineTotalUsdCents: number;
}

export function allocateTotalOverride(lines: AllocLine[], overrideTotalUsdCents: number): AllocatedLine[] {
  // A fractional total (e.g. 500.5) would floor into integers summing to a
  // different value, silently breaking the Σ(lines) ≡ total invariant.
  if (!Number.isInteger(overrideTotalUsdCents)) {
    throw new Error('VALIDATION: override total must be integer minor units');
  }
  if (lines.some((l) => l.suggestedLineTotalUsdCents == null)) {
    throw new Error('VALIDATION: cannot apply a total override while any line price is unknown');
  }
  const surchargeSum = lines
    .filter((l) => l.lineType === 'SURCHARGE')
    .reduce((s, l) => s + l.suggestedLineTotalUsdCents!, 0);
  const allocatable = lines.filter((l) => l.lineType === 'NORMAL');
  if (allocatable.length === 0) {
    throw new Error('VALIDATION: no allocatable lines — adjust line prices directly');
  }
  const suggestedSum = allocatable.reduce((s, l) => s + l.suggestedLineTotalUsdCents!, 0);
  if (suggestedSum === 0) {
    throw new Error('VALIDATION: allocatable suggested total is zero — proportional allocation undefined');
  }
  const pool = overrideTotalUsdCents - surchargeSum;
  if (pool <= 0) {
    throw new Error('VALIDATION: override total does not cover fixed surcharge lines');
  }

  // Largest-remainder, properly applied (spec): floor shares first…
  const shares = allocatable.map((l, i) => {
    const exactNum = pool * l.suggestedLineTotalUsdCents!;
    // pool × weight must stay a safe integer (~$1M × $1M ceiling) or the
    // floor/remainder arithmetic below silently loses precision.
    if (!Number.isSafeInteger(exactNum)) {
      throw new Error('VALIDATION: allocation magnitude exceeds safe integer range');
    }
    const floor = Math.floor(exactNum / suggestedSum);
    return { i, floor, remainder: exactNum % suggestedSum };
  });
  let leftover = pool - shares.reduce((s, x) => s + x.floor, 0);
  // …then one unit each in descending fractional-remainder order, ties by position.
  const order = [...shares].sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const extra = new Map<number, number>();
  for (const s of order) {
    if (leftover <= 0) break;
    extra.set(s.i, 1);
    leftover -= 1;
  }

  const allocated = allocatable.map((l, i) => ({
    ...l,
    actualLineTotalUsdCents: shares[i].floor + (extra.get(i) ?? 0),
  }));
  if (allocated.some((l) => l.actualLineTotalUsdCents < 0)) {
    throw new Error('VALIDATION: allocation produced a negative line price');
  }

  // Self-enforce the Σ(NORMAL lines) ≡ pool invariant rather than trusting the math above.
  const allocatedSum = allocated.reduce((s, l) => s + l.actualLineTotalUsdCents, 0);
  if (allocatedSum !== pool) {
    throw new Error('INTERNAL: allocation sum invariant violated');
  }

  // Reassemble in original order, surcharges untouched.
  let ai = 0;
  return lines.map((l) => (l.lineType === 'SURCHARGE'
    ? { ...l, actualLineTotalUsdCents: l.suggestedLineTotalUsdCents! }
    : allocated[ai++]));
}
