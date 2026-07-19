import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  LIST_BASE_EVIDENCE_QUERY,
  LIST_PUBLISHED_EVIDENCE_QUERY,
  assertBaseEvidenceReadDenied,
  isAuthorizationDenial,
  readPublishedEvidence,
} from './evidencePublicRead';
import type { EvidenceGraphqlClient } from './evidenceSeedOperations';

const clientReturning = (impl: (request: any) => any): EvidenceGraphqlClient => ({
  graphql: vi.fn(async (request: any) => impl(request)),
});

const clientThrowing = (value: unknown): EvidenceGraphqlClient => ({
  graphql: vi.fn(async () => {
    throw value;
  }),
});

describe('readPublishedEvidence', () => {
  it('sends the JSON productSlug query under apiKey and returns raw + parsed records', async () => {
    const records = [{ id: 'e1', title: 'Paper', status: 'published' }];
    const client = clientReturning(() => ({ data: { listPublishedEvidence: JSON.stringify(records) } }));

    const result = await readPublishedEvidence(client, 'ald');

    expect(client.graphql).toHaveBeenCalledWith({
      query: LIST_PUBLISHED_EVIDENCE_QUERY,
      variables: { productSlug: 'ald' },
      authMode: 'apiKey',
    });
    expect(result.records).toEqual(records);
    expect(JSON.parse(result.raw)).toEqual(records);
  });

  it('passes productSlug:null for the product-agnostic ALL read', async () => {
    const client = clientReturning(() => ({ data: { listPublishedEvidence: '[]' } }));

    await readPublishedEvidence(client);

    expect(client.graphql).toHaveBeenCalledWith({
      query: LIST_PUBLISHED_EVIDENCE_QUERY,
      variables: { productSlug: null },
      authMode: 'apiKey',
    });
  });

  it('accepts an already-parsed array payload (data client may pre-parse AWSJSON)', async () => {
    const records = [{ id: 'e1', status: 'published' }];
    const client = clientReturning(() => ({ data: { listPublishedEvidence: records } }));

    const result = await readPublishedEvidence(client, 'ald');

    expect(result.records).toEqual(records);
    expect(JSON.parse(result.raw)).toEqual(records);
  });

  it('throws when graphql RESOLVES with errors (test-mock shape)', async () => {
    const client = clientReturning(() => ({ errors: [{ message: 'boom' }] }));
    await expect(readPublishedEvidence(client, 'ald')).rejects.toThrow(/listPublishedEvidence\(ald\) errored.*boom/i);
  });

  it('throws when graphql REJECTS with errors (real amplify shape)', async () => {
    const client = clientThrowing({ data: {}, errors: [{ message: 'network denied' }] });
    await expect(readPublishedEvidence(client, 'ald')).rejects.toThrow(/listPublishedEvidence\(ald\) errored.*network denied/i);
  });

  it('surfaces a bare transport rejection (no errors array)', async () => {
    const client = clientThrowing(new Error('ECONNRESET'));
    await expect(readPublishedEvidence(client, 'ald')).rejects.toThrow(/listPublishedEvidence\(ald\) errored.*ECONNRESET/i);
  });

  it('never renders "undefined" when a rejected errors array lacks messages', async () => {
    const client = clientThrowing({ data: {}, errors: [{ errorType: 'SomeError' }] });
    const err = await readPublishedEvidence(client, 'ald').catch((e: Error) => e);
    expect((err as Error).message).not.toContain('undefined');
    expect((err as Error).message).toContain('SomeError');
  });

  it('treats a null payload as a failure, not an empty set', async () => {
    const client = clientReturning(() => ({ data: { listPublishedEvidence: null } }));
    await expect(readPublishedEvidence(client, 'ald')).rejects.toThrow(/returned no data \(null payload\)/i);
  });

  it('rejects a non-array payload', async () => {
    const client = clientReturning(() => ({ data: { listPublishedEvidence: JSON.stringify({ nope: true }) } }));
    await expect(readPublishedEvidence(client, 'ald')).rejects.toThrow(/non-array payload/i);
  });

  it('rejects a non-JSON string payload', async () => {
    const client = clientReturning(() => ({ data: { listPublishedEvidence: 'not json' } }));
    await expect(readPublishedEvidence(client, 'ald')).rejects.toThrow(/non-JSON payload/i);
  });
});

describe('isAuthorizationDenial', () => {
  it('recognizes AppSync auth errorTypes and message fallbacks', () => {
    expect(isAuthorizationDenial({ errorType: 'Unauthorized' })).toBe(true);
    expect(isAuthorizationDenial({ errorType: 'UnauthorizedException' })).toBe(true);
    expect(isAuthorizationDenial({ message: 'Not Authorized to access listEvidences' })).toBe(true);
    expect(isAuthorizationDenial({ message: 'unauthorized' })).toBe(true);
  });

  it('does not treat a generic error as a denial', () => {
    expect(isAuthorizationDenial({ errorType: 'ValidationException', message: 'bad input' })).toBe(false);
    expect(isAuthorizationDenial({})).toBe(false);
  });
});

describe('assertBaseEvidenceReadDenied', () => {
  it('queries listEvidences under apiKey and returns the denial message when amplify REJECTS', async () => {
    const client = clientThrowing({ data: {}, errors: [{ errorType: 'Unauthorized', message: 'Unauthorized' }] });

    await expect(assertBaseEvidenceReadDenied(client)).resolves.toBe('Unauthorized');
    expect(client.graphql).toHaveBeenCalledWith({ query: LIST_BASE_EVIDENCE_QUERY, authMode: 'apiKey' });
  });

  it('returns the denial message when graphql RESOLVES with an auth error (test-mock shape)', async () => {
    const client = clientReturning(() => ({ data: null, errors: [{ errorType: 'Unauthorized', message: 'Not Authorized' }] }));
    await expect(assertBaseEvidenceReadDenied(client)).resolves.toBe('Not Authorized');
  });

  it('SECURITY FAILs when the base read succeeds with no errors (publicly readable)', async () => {
    const client = clientReturning(() => ({ data: { listEvidences: { items: [{ id: 'e1' }] } } }));
    await expect(assertBaseEvidenceReadDenied(client)).rejects.toThrow(/publicly readable via apiKey/i);
  });

  it('SECURITY FAILs when errors exist but none are an authorization denial', async () => {
    const client = clientThrowing({ data: {}, errors: [{ errorType: 'ValidationException', message: 'bad request' }] });
    await expect(assertBaseEvidenceReadDenied(client)).rejects.toThrow(/expected an authorization denial/i);
  });

  it('re-throws a genuine transport error (rejection without an errors array)', async () => {
    const client = clientThrowing(new Error('ETIMEDOUT'));
    await expect(assertBaseEvidenceReadDenied(client)).rejects.toThrow(/ETIMEDOUT/);
  });
});

describe('query constants', () => {
  it('uses the task-specified JSON productSlug query for the public read', () => {
    expect(LIST_PUBLISHED_EVIDENCE_QUERY).toBe(
      'query($productSlug:String){ listPublishedEvidence(productSlug:$productSlug) }',
    );
  });

  it('probes the base listEvidences model for the denial check', () => {
    expect(LIST_BASE_EVIDENCE_QUERY).toContain('listEvidences');
  });
});

describe('acceptance scripts are stale-outputs robust (no typed accessors)', () => {
  const read = (name: string) => readFileSync(resolve(process.cwd(), 'scripts', name), 'utf8');

  it('verify-evidence-no-oem.ts reads via raw apiKey GraphQL, not client.queries', () => {
    const source = read('verify-evidence-no-oem.ts');
    expect(source).not.toContain('.queries.listPublishedEvidence');
    expect(source).toContain("from './lib/evidencePublicRead'");
    expect(source).toContain('readPublishedEvidence');
  });

  it('verify-evidence-boundary.ts avoids client.models and client.queries', () => {
    const source = read('verify-evidence-boundary.ts');
    expect(source).not.toContain('client.models.Evidence');
    expect(source).not.toContain('.queries.listPublishedEvidence');
    expect(source).toContain("from './lib/evidencePublicRead'");
    expect(source).toContain('assertBaseEvidenceReadDenied');
    expect(source).toContain('readPublishedEvidence');
  });
});
