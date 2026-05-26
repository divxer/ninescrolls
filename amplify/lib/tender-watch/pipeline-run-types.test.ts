import { describe, it, expect } from 'vitest';
import {
    reduceNotificationStatus,
    pipelineRunSummaryKey,
    pipelineRunSourceKey,
    pipelineRunGsi5Sk,
} from './pipeline-run-types';

describe('reduceNotificationStatus', () => {
    it('returns SUCCESS when both sent', () => {
        expect(reduceNotificationStatus({ status: 'sent' }, { status: 'sent' })).toEqual({ status: 'SUCCESS', error: null });
    });

    it('returns SUCCESS when one sent + one skipped (either order)', () => {
        expect(reduceNotificationStatus({ status: 'sent' }, { status: 'skipped' })).toEqual({ status: 'SUCCESS', error: null });
        expect(reduceNotificationStatus({ status: 'skipped' }, { status: 'sent' })).toEqual({ status: 'SUCCESS', error: null });
    });

    it('returns SKIPPED when both skipped', () => {
        expect(reduceNotificationStatus({ status: 'skipped' }, { status: 'skipped' })).toEqual({ status: 'SKIPPED', error: null });
    });

    it('returns PARTIAL when exactly one failed', () => {
        const result = reduceNotificationStatus({ status: 'failed', error: 'SES quota' }, { status: 'sent' });
        expect(result).toEqual({ status: 'PARTIAL', error: 'SES quota' });
    });

    it('returns PARTIAL when failed + skipped', () => {
        const result = reduceNotificationStatus({ status: 'failed', error: 'SES quota' }, { status: 'skipped' });
        expect(result).toEqual({ status: 'PARTIAL', error: 'SES quota' });
    });

    it('returns FAILED when both failed and joins errors', () => {
        const result = reduceNotificationStatus(
            { status: 'failed', error: 'HP throw' },
            { status: 'failed', error: 'Digest throw' },
        );
        expect(result.status).toBe('FAILED');
        expect(result.error).toContain('HP throw');
        expect(result.error).toContain('Digest throw');
    });
});

describe('key builders', () => {
    it('builds summary key', () => {
        expect(pipelineRunSummaryKey('abc-123')).toEqual({ PK: 'RUN#abc-123', SK: 'SUMMARY' });
    });

    it('builds source key', () => {
        expect(pipelineRunSourceKey('abc-123', 'sam')).toEqual({ PK: 'RUN#abc-123', SK: 'SOURCE#sam' });
    });

    it('builds GSI5SK from startedAt and execId', () => {
        expect(pipelineRunGsi5Sk('2026-05-27T02:00:00.000Z', 'abc-123')).toBe('2026-05-27T02:00:00.000Z#abc-123');
    });
});
