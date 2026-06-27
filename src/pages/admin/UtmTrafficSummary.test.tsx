import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { UtmTrafficSummary } from './UtmTrafficSummary';
import type { UtmEvent } from '../../services/behaviorAnalytics';

const events: UtmEvent[] = [
  { eventType: 'page_view', utmSource: 'mrs', visitorId: 'v1', utmContent: 'qr_video' },
  { eventType: 'page_view', utmSource: 'mrs', visitorId: 'v2', utmContent: 'qr_brochure' },
  { eventType: 'page_view', utmSource: 'linkedin', visitorId: 'v3', utmContent: 'qr_video' },
];

describe('UtmTrafficSummary', () => {
  it('renders a row per source and calls onFilterChange on row click', () => {
    const onFilterChange = vi.fn();
    render(
      <UtmTrafficSummary events={events} groupBy="source" onGroupByChange={() => {}} filter={{}} onFilterChange={onFilterChange} />
    );
    expect(screen.getByText('mrs')).toBeInTheDocument();
    expect(screen.getByText('linkedin')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mrs'));
    expect(onFilterChange).toHaveBeenCalledWith({ source: 'mrs' });
  });

  it('with source=mrs filter + group by content, qr_video shows Visits=1 (linkedin excluded)', () => {
    render(
      <UtmTrafficSummary events={events} groupBy="content" onGroupByChange={() => {}} filter={{ source: 'mrs' }} onFilterChange={() => {}} />
    );
    expect(screen.getByText('qr_brochure')).toBeInTheDocument();
    // qr_video exists under both mrs and linkedin; with source=mrs it must aggregate to
    // exactly 1 visit. Assert the Visits cell of the qr_video row precisely — a wrong
    // aggregation to 2 (linkedin leaking in) must fail this test.
    const videoRow = screen.getByText('qr_video').closest('tr')!;
    const cells = within(videoRow).getAllByRole('cell'); // [value, visits, visitors, knownOrgs]
    expect(cells[1]).toHaveTextContent('1'); // Visits
    expect(cells[2]).toHaveTextContent('1'); // Visitors
  });

  it('shows "no UTM traffic" empty state when there is no UTM data', () => {
    render(
      <UtmTrafficSummary events={[{ eventType: 'page_view', visitorId: 'v1' }]} groupBy="source" onGroupByChange={() => {}} filter={{}} onFilterChange={() => {}} />
    );
    expect(screen.getByText(/暂无 UTM 流量/)).toBeInTheDocument();
  });

  it('shows "no matching rows" when search excludes all rows', () => {
    render(
      <UtmTrafficSummary events={events} groupBy="source" onGroupByChange={() => {}} filter={{}} onFilterChange={() => {}} />
    );
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No matching UTM rows/)).toBeInTheDocument();
  });
});
