import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrganizationTimeline } from './OrganizationTimeline';

const items = [
  { id: 'a', occurredAt: '2026-03-02T00:00:00Z', source: 'order', kind: 'order_created', sourceFilterGroup: 'order', icon: 'order', tone: 'confirmed', primaryLabel: 'Order created — X', resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: null, isInternalOnly: false, productModel: 'X', specificModel: null, equipmentCategory: null, leadType: null, productName: null, stageFrom: null, stageTo: null, fileName: null, pageCount: null, activeSeconds: null, topPaths: null, direction: null, bodySnippet: null, externalUrl: null, sourceEntityType: 'order', sourceEntityId: 'ord-1', payload: null },
  { id: 'b', occurredAt: '2026-03-01T00:00:00Z', source: 'analytics', kind: 'site_visit_session', sourceFilterGroup: 'site_visits', icon: 'site_visit', tone: 'inferred', primaryLabel: 'Site visit — 3 pages', resolutionStatus: 'resolved', resolutionReason: 'visitor_prior_event', confidence: 0.72, isInternalOnly: false, productModel: null, specificModel: null, equipmentCategory: null, leadType: null, productName: null, stageFrom: null, stageTo: null, fileName: null, pageCount: 3, activeSeconds: 240, topPaths: ['/x'], direction: null, bodySnippet: null, externalUrl: null, sourceEntityType: 'analytics_session', sourceEntityId: 'sess-1', payload: null },
] as never[];

const gmailItem = (o: Record<string, unknown>) => ({
  id: 'g1', occurredAt: '2026-03-03T00:00:00Z', source: 'gmail', kind: 'email', sourceFilterGroup: 'email',
  icon: 'mail', tone: 'confirmed', primaryLabel: 'RFQ: ICP-RIE pricing', resolutionStatus: 'resolved',
  resolutionReason: 'contact_email_exact', confidence: null, isInternalOnly: false,
  productModel: null, specificModel: null, equipmentCategory: null, leadType: null, productName: null,
  stageFrom: null, stageTo: null, fileName: null, pageCount: null, activeSeconds: null, topPaths: null,
  direction: 'inbound', bodySnippet: 'Could you send a quote for the ICP-RIE system?',
  externalUrl: 'https://mail.google.com/mail/u/0/#search/rfc822msgid:abc',
  sourceEntityType: 'gmail', sourceEntityId: 'gm-1', payload: null,
  ...o,
});

const baseProps = { items, loading: false, error: null as Error | null, hasMore: false, loadMore: vi.fn(), reload: vi.fn(), includeInternal: false, setIncludeInternal: vi.fn() };

const renderTL = (props: typeof baseProps) => render(<MemoryRouter><OrganizationTimeline {...props} /></MemoryRouter>);

describe('OrganizationTimeline', () => {
  it('renders mixed kinds as cards', () => {
    renderTL(baseProps);
    expect(screen.getByText('Order created')).toBeTruthy();
    expect(screen.getByText('Site visit')).toBeTruthy();
  });

  it('source chips filter ONLY the loaded items (client-side)', () => {
    renderTL(baseProps);
    fireEvent.click(screen.getByRole('button', { name: 'Site visits' }));
    expect(screen.queryByText('Order created')).toBeNull();
    expect(screen.getByText('Site visit')).toBeTruthy();
  });

  it('"Load more" calls loadMore only when hasMore', () => {
    const loadMore = vi.fn();
    const { rerender } = render(<MemoryRouter><OrganizationTimeline {...baseProps} hasMore={false} loadMore={loadMore} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
    rerender(<MemoryRouter><OrganizationTimeline {...baseProps} hasMore loadMore={loadMore} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(loadMore).toHaveBeenCalled();
  });

  it('"Show internal" toggle calls setIncludeInternal(true) (drives a refetch upstream, not a client reveal)', () => {
    const setIncludeInternal = vi.fn();
    renderTL({ ...baseProps, setIncludeInternal });
    fireEvent.click(screen.getByRole('checkbox', { name: /show internal/i }));
    expect(setIncludeInternal).toHaveBeenCalledWith(true);
  });

  it('shows skeleton on initial load, inline retry on error, and empty state', () => {
    const { rerender } = render(<MemoryRouter><OrganizationTimeline {...baseProps} items={[]} loading /></MemoryRouter>);
    expect(screen.getByTestId('timeline-skeleton')).toBeTruthy();
    rerender(<MemoryRouter><OrganizationTimeline {...baseProps} items={[]} loading={false} error={new Error('x')} /></MemoryRouter>);
    expect(screen.getByText(/couldn.t load timeline/i)).toBeTruthy();
    rerender(<MemoryRouter><OrganizationTimeline {...baseProps} items={[]} loading={false} error={null} /></MemoryRouter>);
    expect(screen.getByText(/no recorded interactions/i)).toBeTruthy();
  });

  it('a mid-list error keeps already-rendered cards (does not wipe them) and offers inline retry', () => {
    renderTL({ ...baseProps, error: new Error('load more failed') });
    expect(screen.getByText('Order created')).toBeTruthy();
    expect(screen.getByText('Site visit')).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('links a card to its source-record detail page (order → /admin/orders/{id}); analytics has no link', () => {
    renderTL(baseProps);
    expect(screen.getByText('Order created').closest('a')?.getAttribute('href')).toBe('/admin/orders/ord-1');
    expect(screen.getByText('Site visit').closest('a')).toBeNull();
  });

  it('renders an email row (subject as title + bodySnippet) with a safe external Gmail link', () => {
    renderTL({ ...baseProps, items: [gmailItem({})] as never[] });
    expect(screen.getByText('RFQ: ICP-RIE pricing')).toBeTruthy();
    expect(screen.getByText('Could you send a quote for the ICP-RIE system?')).toBeTruthy();
    const link = screen.getByText('RFQ: ICP-RIE pricing').closest('a');
    expect(link?.getAttribute('href')).toBe('https://mail.google.com/mail/u/0/#search/rfc822msgid:abc');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does NOT render a link when externalUrl origin is not exactly https://mail.google.com', () => {
    renderTL({ ...baseProps, items: [gmailItem({ externalUrl: 'https://evil.example.com/mail.google.com' })] as never[] });
    expect(screen.getByText('RFQ: ICP-RIE pricing').closest('a')).toBeNull();
  });

  it('the Email chip filters to gmail rows only', () => {
    renderTL({ ...baseProps, items: [...items, gmailItem({})] as never[] });
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(screen.queryByText('Order created')).toBeNull();
    expect(screen.queryByText('Site visit')).toBeNull();
    expect(screen.getByText('RFQ: ICP-RIE pricing')).toBeTruthy();
  });
});
