import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

const { trackCustomEvent } = vi.hoisted(() => ({ trackCustomEvent: vi.fn() }));
const { submitLead } = vi.hoisted(() => ({ submitLead: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../hooks/useCombinedAnalytics', () => ({
  useCombinedAnalytics: () => ({ trackCustomEvent }),
}));
vi.mock('../../services/leadsService', () => ({ submitLead }));

import { DownloadGateModal } from './DownloadGateModal';

function fill(container: HTMLElement) {
  const set = (name: string, value: string) => {
    const el = container.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement;
    fireEvent.change(el, { target: { value } });
  };
  set('fullName', 'Ada Lovelace');
  set('email', 'ada@lab.edu');
  set('organization', 'Analytical Engine Lab');
  set('researchAreas', 'MEMS');
  set('intent', 'Actively looking to buy');
}

describe('DownloadGateModal', () => {
  beforeEach(() => {
    trackCustomEvent.mockClear();
    submitLead.mockClear();
  });

  it('includes productName in the Datasheet Downloaded event on submit', async () => {
    const { container } = render(
      <DownloadGateModal
        isOpen onClose={vi.fn()}
        fileUrl="/docs/rie-etcher.pdf" fileName="rie-etcher-datasheet.pdf"
        productName="RIE Etcher"
      />,
    );
    fill(container);
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() =>
      expect(trackCustomEvent).toHaveBeenCalledWith(
        'Datasheet Downloaded',
        expect.objectContaining({ productName: 'RIE Etcher' }),
      ),
    );
  });
});
