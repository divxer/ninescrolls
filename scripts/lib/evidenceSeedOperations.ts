export interface EvidenceGraphqlClient {
  graphql(request: Record<string, unknown>): Promise<any>;
}

export interface EvidenceRecord {
  id: string;
  slug: string;
  type?: string;
  status?: string;
  meta?: string | null;
  summary?: string | null;
  products?: string[] | null;
}

export type Classification = [
  verificationTier: 'A' | 'B',
  capabilityRole: 'primary' | 'substantial' | 'incidental',
];

export interface Refinement {
  slug: string;
  instrument: string;
  originalInstrument: string;
  via: string;
  summaryFor(record: EvidenceRecord, meta: Record<string, any>): string;
}

export interface FalsePositiveCorrection {
  slug: string;
  removedReason: string;
}

const AUTH = { authMode: 'userPool' as const };
const BY_SLUG = `query EvidenceBySlug($slug:String!){ listEvidenceBySlug(slug:$slug,limit:1){ items{ id slug type status meta summary products } } }`;
const CREATE = `mutation CreateEvidence($input:CreateEvidenceInput!){ createEvidence(input:$input){ id slug } }`;
const UPDATE = `mutation UpdateEvidence($input:UpdateEvidenceInput!){ updateEvidence(input:$input){ id slug status meta } }`;
const LIST = `query ListEvidence($nextToken:String){ listEvidences(limit:200,nextToken:$nextToken){ items{ id slug type status meta } nextToken } }`;

function graphQlError(operation: string, errors: Array<{ message?: string }>): Error {
  const detail = errors.map((error) => error.message ?? JSON.stringify(error)).join('; ');
  return new Error(`${operation} failed: ${detail}`);
}

export function requireApply(argv: string[], scriptName: string): void {
  const unknown = argv.filter((arg) => arg !== '--apply');
  if (unknown.length) throw new Error(`${scriptName}: unknown argument(s): ${unknown.join(', ')}`);
  if (argv.filter((arg) => arg === '--apply').length !== 1) {
    throw new Error(`${scriptName}: refusing writes without exactly one --apply confirmation`);
  }
}

export async function checkedGraphql<T = any>(
  client: EvidenceGraphqlClient,
  request: Record<string, unknown>,
  operation: string,
): Promise<T> {
  const result = await client.graphql(request);
  if (result?.errors?.length) throw graphQlError(operation, result.errors);
  if (!result?.data) throw new Error(`${operation} failed: GraphQL response contained no data`);
  return result as T;
}

function parseMeta(record: Pick<EvidenceRecord, 'slug' | 'meta'>): Record<string, any> {
  if (!record.meta) return {};
  try {
    return JSON.parse(record.meta);
  } catch (error) {
    throw new Error(`Invalid meta JSON for ${record.slug}: ${(error as Error).message}`);
  }
}

export async function evidenceBySlug(
  client: EvidenceGraphqlClient,
  slug: string,
): Promise<EvidenceRecord | null> {
  const result = await checkedGraphql<any>(client, {
    query: BY_SLUG,
    variables: { slug },
    ...AUTH,
  }, `lookup ${slug}`);
  const items = result.data.listEvidenceBySlug?.items;
  if (!Array.isArray(items)) throw new Error(`lookup ${slug} failed: missing items array`);
  return items[0] ?? null;
}

export async function createEvidenceIfMissing(
  client: EvidenceGraphqlClient,
  input: Record<string, unknown> & { slug: string },
): Promise<'created' | 'skipped'> {
  if (await evidenceBySlug(client, input.slug)) return 'skipped';
  const result = await checkedGraphql<any>(client, {
    query: CREATE,
    variables: { input },
    ...AUTH,
  }, `create ${input.slug}`);
  if (!result.data.createEvidence?.id) {
    throw new Error(`create ${input.slug} failed: mutation returned no record`);
  }
  return 'created';
}

export async function refineEvidence(
  client: EvidenceGraphqlClient,
  refinement: Refinement,
): Promise<'refined' | 'converged' | 'missing'> {
  const record = await evidenceBySlug(client, refinement.slug);
  if (!record) return 'missing';

  const meta = parseMeta(record);
  const previousInstrument = meta.instrumentAsNamed;
  if (previousInstrument == null) {
    throw new Error(`refine ${refinement.slug} failed: original instrument was missing`);
  }
  meta.instrumentAsNamed = refinement.instrument;
  // Preserve genuine first-run provenance and repair the known old rerun bug,
  // which replaced instrumentRefinedFrom with the already-refined value.
  if (meta.instrumentRefinedFrom == null) meta.instrumentRefinedFrom = previousInstrument;
  else if (meta.instrumentRefinedFrom === refinement.instrument) {
    meta.instrumentRefinedFrom = refinement.originalInstrument;
  }
  meta.instrumentRefinedVia = refinement.via;
  const summary = refinement.summaryFor(record, meta);
  const serializedMeta = JSON.stringify(meta);

  if (record.meta === serializedMeta && record.summary === summary) return 'converged';

  const result = await checkedGraphql<any>(client, {
    query: UPDATE,
    variables: { input: { id: record.id, meta: serializedMeta, summary } },
    ...AUTH,
  }, `refine ${refinement.slug}`);
  if (!result.data.updateEvidence?.id) {
    throw new Error(`refine ${refinement.slug} failed: mutation returned no record`);
  }
  return 'refined';
}

export async function correctFalsePositives(
  client: EvidenceGraphqlClient,
  corrections: FalsePositiveCorrection[],
): Promise<{ archived: number; converged: number; missing: number }> {
  const tally = { archived: 0, converged: 0, missing: 0 };
  for (const correction of corrections) {
    const record = await evidenceBySlug(client, correction.slug);
    if (!record) {
      tally.missing++;
      continue;
    }
    const meta = parseMeta(record);
    meta.removedReason = correction.removedReason;
    const serializedMeta = JSON.stringify(meta);
    if (record.status === 'archived' && record.meta === serializedMeta) {
      tally.converged++;
      continue;
    }
    const result = await checkedGraphql<any>(client, {
      query: UPDATE,
      variables: { input: { id: record.id, status: 'archived', meta: serializedMeta } },
      ...AUTH,
    }, `archive false positive ${correction.slug}`);
    if (!result.data.updateEvidence?.id || result.data.updateEvidence.status !== 'archived') {
      throw new Error(`archive false positive ${correction.slug} failed: archived postcondition not met`);
    }
    tally.archived++;
  }
  return tally;
}

export async function classifyPublications(
  client: EvidenceGraphqlClient,
  classifications: Record<string, Classification>,
  wave1Slugs: ReadonlySet<string>,
): Promise<{
  classified: number;
  updated: number;
  converged: number;
  tally: Record<string, number>;
}> {
  const items: EvidenceRecord[] = [];
  let nextToken: string | null = null;
  do {
    const result = await checkedGraphql<any>(client, {
      query: LIST,
      variables: { nextToken },
      ...AUTH,
    }, 'list evidence for classification');
    const page = result.data.listEvidences;
    if (!Array.isArray(page?.items)) {
      throw new Error('list evidence for classification failed: missing items array');
    }
    items.push(...page.items);
    nextToken = page.nextToken ?? null;
  } while (nextToken);

  const publications = items.filter((item) =>
    item.type === 'publication' && item.status !== 'archived');
  const unmapped = publications
    .filter((item) => !Object.prototype.hasOwnProperty.call(classifications, item.slug))
    .map((item) => item.slug)
    .sort();
  if (unmapped.length) {
    throw new Error(`Unmapped active publication(s); no records were changed: ${unmapped.join(', ')}`);
  }

  const tally: Record<string, number> = {
    wave1: 0, wave2: 0, wave3: 0,
    A: 0, B: 0,
    primary: 0, substantial: 0, incidental: 0,
    eligible: 0,
  };
  let updated = 0;
  let converged = 0;

  for (const record of publications) {
    const [tier, role] = classifications[record.slug];
    const launchEligible = tier === 'A' && role !== 'incidental';
    const publishPriority = wave1Slugs.has(record.slug)
      ? 'wave1'
      : launchEligible ? 'wave2' : 'wave3';
    const meta = parseMeta(record);
    meta.verificationTier = tier;
    meta.capabilityRole = role;
    meta.launchEligible = launchEligible;
    meta.publishPriority = publishPriority;
    const serializedMeta = JSON.stringify(meta);

    if (record.meta === serializedMeta) {
      converged++;
    } else {
      const result = await checkedGraphql<any>(client, {
        query: UPDATE,
        variables: { input: { id: record.id, meta: serializedMeta } },
        ...AUTH,
      }, `classify ${record.slug}`);
      if (!result.data.updateEvidence?.id) {
        throw new Error(`classify ${record.slug} failed: mutation returned no record`);
      }
      updated++;
    }

    // Count only after a successful mutation or a verified converged record.
    tally[publishPriority]++;
    tally[tier]++;
    tally[role]++;
    if (launchEligible) tally.eligible++;
  }

  return { classified: publications.length, updated, converged, tally };
}
