import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  assertUniqueSlugs,
  classifyPublications,
  correctFalsePositives,
  createEvidenceIfMissing,
  refineEvidence,
  requireApply,
  type EvidenceGraphqlClient,
} from './lib/evidenceSeedOperations';

const FALSE_POSITIVES = [
  { slug: 'pub-tailong-sputter-cu-nanotwin-mi-2024', removedReason: 'Uses non-Tailong VCT 300.' },
  { slug: 'pub-tailong-sputter-wo3-sensor-sensors-2025', removedReason: 'Tailong is a gas supplier.' },
];

const queryResult = (items: any[]) => ({
  data: { listEvidences: { items, nextToken: null } },
});

describe('evidence seeder safety contracts', () => {
  it('does not include the two known false positives in the catalog seed rows', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/seed-evidence-catalog.ts'),
      'utf8',
    );
    const rows = source.slice(source.indexOf('const ROWS'), source.indexOf('async function main'));

    expect(rows).not.toContain(FALSE_POSITIVES[0].slug);
    expect(rows).not.toContain(FALSE_POSITIVES[1].slug);
  });

  it('archives existing false positives and converges without a second mutation', async () => {
    const records = new Map(FALSE_POSITIVES.map(({ slug }) => [slug, {
      id: `id-${slug}`, slug, status: 'draft', meta: JSON.stringify({ source: 'catalog' }),
    }]));
    let updates = 0;
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async (request: any) => {
        if (request.variables.slug) {
          return { data: { listEvidenceBySlug: { items: [records.get(request.variables.slug)] } } };
        }
        const input = request.variables.input;
        updates++;
        records.set(
          [...records.values()].find((record) => record.id === input.id)!.slug,
          { ...[...records.values()].find((record) => record.id === input.id)!, ...input },
        );
        return { data: { updateEvidence: { ...input, slug: 'updated' } } };
      }),
    };

    await expect(correctFalsePositives(client, FALSE_POSITIVES)).resolves.toEqual({
      archived: 2, converged: 0, missing: 0,
    });
    await expect(correctFalsePositives(client, FALSE_POSITIVES)).resolves.toEqual({
      archived: 0, converged: 2, missing: 0,
    });
    expect(updates).toBe(2);
    for (const correction of FALSE_POSITIVES) {
      const record = records.get(correction.slug)!;
      expect(record.status).toBe('archived');
      expect(JSON.parse(record.meta).removedReason).toBe(correction.removedReason);
    }
  });

  it('makes the false-positive correction a no-op on a clean database', async () => {
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async () => ({ data: { listEvidenceBySlug: { items: [] } } })),
    };

    await expect(correctFalsePositives(client, FALSE_POSITIVES)).resolves.toEqual({
      archived: 0, converged: 0, missing: 2,
    });
    expect(client.graphql).toHaveBeenCalledTimes(2);
  });

  it('preflights every unknown active publication before classifier writes', async () => {
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async () => queryResult([
        { id: 'known', slug: 'known', type: 'publication', status: 'draft', meta: '{}' },
        { id: 'unknown', slug: 'unknown', type: 'publication', status: 'draft', meta: '{}' },
      ])),
    };

    await expect(classifyPublications(
      client,
      { known: ['A', 'primary'] },
      new Set(),
    )).rejects.toThrow(/no records were changed.*unknown/i);
    expect(client.graphql).toHaveBeenCalledTimes(1);
  });

  it('treats reserved object keys as unknown before any classifier write', async () => {
    let writes = 0;
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async (request: any) => {
        if (request.variables.input) {
          writes++;
          return { data: { updateEvidence: { id: request.variables.input.id } } };
        }
        return queryResult([
          { id: 'known', slug: 'known', type: 'publication', status: 'draft', meta: '{}' },
          { id: 'constructor', slug: 'constructor', type: 'publication', status: 'draft', meta: '{}' },
          { id: 'to-string', slug: 'toString', type: 'publication', status: 'draft', meta: '{}' },
        ]);
      }),
    };

    await expect(classifyPublications(
      client,
      { known: ['A', 'primary'] },
      new Set(),
    )).rejects.toThrow(/constructor.*toString.*no records were changed|no records were changed.*constructor.*toString/i);
    expect(writes).toBe(0);
  });

  it('treats a classifier mutation error as fatal before returning a tally', async () => {
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn()
        .mockResolvedValueOnce(queryResult([
          { id: 'known', slug: 'known', type: 'publication', status: 'draft', meta: '{}' },
        ]))
        .mockResolvedValueOnce({ errors: [{ message: 'conditional check failed' }] }),
    };

    await expect(classifyPublications(
      client,
      { known: ['A', 'primary'] },
      new Set(['known']),
    )).rejects.toThrow(/classify known failed.*conditional check failed/i);
  });

  it('returns stable classifier tallies and skips a converged rerun', async () => {
    let record = {
      id: 'known', slug: 'known', type: 'publication', status: 'draft', meta: '{}',
    };
    let updates = 0;
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async (request: any) => {
        if (!request.variables.input) return queryResult([record]);
        updates++;
        record = { ...record, ...request.variables.input };
        return { data: { updateEvidence: { id: record.id, slug: record.slug } } };
      }),
    };

    const first = await classifyPublications(
      client, { known: ['A', 'primary'] }, new Set(['known']),
    );
    const second = await classifyPublications(
      client, { known: ['A', 'primary'] }, new Set(['known']),
    );

    expect(first).toMatchObject({ classified: 1, updated: 1, converged: 0 });
    expect(second).toMatchObject({ classified: 1, updated: 0, converged: 1 });
    expect(second.tally).toMatchObject({ wave1: 1, A: 1, primary: 1, eligible: 1 });
    expect(updates).toBe(1);
  });

  it('treats a create mutation GraphQL error as fatal', async () => {
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn()
        .mockResolvedValueOnce({ data: { listEvidenceBySlug: { items: [] } } })
        .mockResolvedValueOnce({ errors: [{ message: 'not authorized' }] }),
    };

    await expect(createEvidenceIfMissing(client, { slug: 'new-record' }))
      .rejects.toThrow(/create new-record failed.*not authorized/i);
  });

  it('creates records as status:draft when the caller omits status (no-leak default)', async () => {
    let createdInput: any = null;
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async (request: any) => {
        if (request.query.includes('listEvidenceBySlug')) {
          return { data: { listEvidenceBySlug: { items: [] } } };
        }
        createdInput = request.variables.input;
        return { data: { createEvidence: { id: 'new', slug: request.variables.input.slug } } };
      }),
    };

    await expect(createEvidenceIfMissing(client, { slug: 'no-status' })).resolves.toBe('created');
    expect(createdInput.status).toBe('draft');
  });

  it('refuses to create a non-draft record and issues no GraphQL call', async () => {
    const graphql = vi.fn();
    const client: EvidenceGraphqlClient = { graphql };

    await expect(
      createEvidenceIfMissing(client, { slug: 'sneaky', status: 'published' }),
    ).rejects.toThrow(/refused: seeders may only create status:draft/i);
    expect(graphql).not.toHaveBeenCalled();
  });

  it('rejects duplicate slugs within a seeder input array before any network call', () => {
    expect(() => assertUniqueSlugs(['a', 'b', 'a', 'c', 'b'], 'seed'))
      .toThrow(/duplicate slug\(s\) in seed input: a, b/i);
    expect(() => assertUniqueSlugs(['a', 'b', 'c'], 'seed')).not.toThrow();
  });

  it('preserves original refinement provenance and skips a converged rerun', async () => {
    let record = {
      id: 'id-1', slug: 'paper', meta: JSON.stringify({ instrumentAsNamed: 'RIE (Tailong)' }),
      summary: 'old', products: ['rie-etcher'],
    };
    let updates = 0;
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async (request: any) => {
        if (request.variables.slug) {
          return { data: { listEvidenceBySlug: { items: [record] } } };
        }
        updates++;
        record = { ...record, ...request.variables.input };
        return { data: { updateEvidence: { id: record.id, slug: record.slug } } };
      }),
    };
    const refinement = {
      slug: 'paper',
      instrument: 'RIE-100',
      originalInstrument: 'RIE (Tailong)',
      via: 'full text',
      summaryFor: () => 'new summary',
    };

    await expect(refineEvidence(client, refinement)).resolves.toBe('refined');
    await expect(refineEvidence(client, refinement)).resolves.toBe('converged');
    expect(updates).toBe(1);
    expect(JSON.parse(record.meta).instrumentRefinedFrom).toBe('RIE (Tailong)');
  });

  it('repairs provenance corrupted by the previous rerun behavior', async () => {
    let record = {
      id: 'id-1', slug: 'paper',
      meta: JSON.stringify({ instrumentAsNamed: 'RIE-100', instrumentRefinedFrom: 'RIE-100' }),
      summary: 'new summary', products: ['rie-etcher'],
    };
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async (request: any) => {
        if (request.variables.slug) {
          return { data: { listEvidenceBySlug: { items: [record] } } };
        }
        record = { ...record, ...request.variables.input };
        return { data: { updateEvidence: { id: record.id, slug: record.slug } } };
      }),
    };

    await refineEvidence(client, {
      slug: 'paper', instrument: 'RIE-100', originalInstrument: 'RIE (Tailong)',
      via: 'full text', summaryFor: () => 'new summary',
    });
    expect(JSON.parse(record.meta).instrumentRefinedFrom).toBe('RIE (Tailong)');
  });

  it('treats a refinement mutation GraphQL error as fatal', async () => {
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn()
        .mockResolvedValueOnce({
          data: { listEvidenceBySlug: { items: [{
            id: 'paper', slug: 'paper', meta: JSON.stringify({ instrumentAsNamed: 'RIE' }),
            summary: 'old', products: ['rie-etcher'],
          }] } },
        })
        .mockResolvedValueOnce({ errors: [{ message: 'write rejected' }] }),
    };

    await expect(refineEvidence(client, {
      slug: 'paper', instrument: 'RIE-100', originalInstrument: 'RIE',
      via: 'full text', summaryFor: () => 'new summary',
    })).rejects.toThrow(/refine paper failed.*write rejected/i);
  });

  it('documents correction before classification in the reproducible sequence', () => {
    const readme = readFileSync(
      resolve(process.cwd(), 'scripts/README-evidence-seeders.md'),
      'utf8',
    );
    const correction = readme.indexOf('npx tsx scripts/correct-evidence-false-positives.ts --apply');
    const classifier = readme.indexOf('npx tsx scripts/classify-evidence-publish-priority.ts --apply');

    expect(correction).toBeGreaterThan(0);
    expect(classifier).toBeGreaterThan(correction);
  });

  it('keeps README Phase-2 tallies derived-consistent with the classifier CLASS table', () => {
    const classifier = readFileSync(
      resolve(process.cwd(), 'scripts/classify-evidence-publish-priority.ts'),
      'utf8',
    );
    const readme = readFileSync(
      resolve(process.cwd(), 'scripts/README-evidence-seeders.md'),
      'utf8',
    );

    const classTable = classifier.slice(
      classifier.indexOf('const CLASS'),
      classifier.indexOf('const WAVE1'),
    );
    const entries = [...classTable.matchAll(
      /'([^']+)': \['([AB])', '(primary|substantial|incidental)'\]/g,
    )].map(([, slug, tier, role]) => ({ slug, tier, role }));

    const wave1Block = classifier.slice(
      classifier.indexOf('const WAVE1'),
      classifier.indexOf('async function main'),
    );
    const wave1 = new Set([...wave1Block.matchAll(/'([^']+)'/g)].map(([, slug]) => slug));

    // Recompute exactly what classifyPublications() derives — from the source of
    // truth (CLASS) — instead of string-matching the prose. A future CLASS edit
    // that desyncs the README now fails this test.
    const d: Record<string, number> = {
      total: entries.length, A: 0, B: 0, eligible: 0, wave1: 0, wave2: 0, wave3: 0,
    };
    for (const { slug, tier, role } of entries) {
      d[tier]++;
      const launchEligible = tier === 'A' && role !== 'incidental';
      if (launchEligible) d.eligible++;
      d[wave1.has(slug) ? 'wave1' : launchEligible ? 'wave2' : 'wave3']++;
    }

    // Reconstructed legacy tail slugs must not sneak back in as invented data.
    expect(classTable).not.toContain('pub-tailong-rie100-nanoforest-ev-capture-acsnano-2025');
    expect(classTable).not.toContain('pub-tailong-rie150-wafer-graphene-cvd-acsanm-2023');
    expect(classTable).not.toContain('pub-tailong-rie100-vdw-photodiode-infomat-2022');
    // Every wave1 hero must actually be a classified record.
    for (const slug of wave1) {
      expect(entries.some((entry) => entry.slug === slug)).toBe(true);
    }

    // The README must state the DERIVED numbers verbatim — self-verifying doc.
    expect(readme).toContain(`${d.total} active Evidence records`);
    expect(readme).toContain(`wave1 **${d.wave1}** · wave2 **${d.wave2}** ·`);
    expect(readme).toContain(
      `wave3 **${d.wave3}**; tier A **${d.A}** / B **${d.B}**; launchEligible **${d.eligible}**`,
    );
  });

  it('uses the checked raw-GraphQL path for the first documented seeder', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/seed-evidence.ts'),
      'utf8',
    );
    const readme = readFileSync(
      resolve(process.cwd(), 'scripts/README-evidence-seeders.md'),
      'utf8',
    );

    expect(source).toContain('createEvidenceIfMissing');
    expect(source).not.toContain('client.models.Evidence');
    expect(readme).toContain('npx tsx scripts/seed-evidence.ts --apply');
  });

  it('requires an explicit, unambiguous apply confirmation', () => {
    expect(() => requireApply([], 'seed')).toThrow(/refusing writes/i);
    expect(() => requireApply(['--apply', '--apply'], 'seed')).toThrow(/exactly one/i);
    expect(() => requireApply(['--apply', '--force'], 'seed')).toThrow(/unknown argument/i);
    expect(() => requireApply(['--apply'], 'seed')).not.toThrow();
  });
});
