import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { StartupPackagePage } from './StartupPackagePage';

vi.mock('../components/common/QuoteModal', () => ({
  QuoteModal: ({
    isOpen,
    onClose,
    onDownloadBrochure,
    downloadLabel,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onDownloadBrochure: () => void;
    downloadLabel: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="quote modal">
        <button type="button" onClick={onDownloadBrochure}>{downloadLabel}</button>
        <button type="button" onClick={onClose}>Close Quote</button>
      </div>
    ) : null,
}));

vi.mock('../components/common/DownloadGateModal', () => ({
  DownloadGateModal: ({
    isOpen,
    onClose,
    fileUrl,
    fileName,
  }: {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileName: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="download gate" data-file-url={fileUrl} data-file-name={fileName}>
        <button type="button" onClick={onClose}>Close Download</button>
      </div>
    ) : null,
}));

function renderStartupPackage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <StartupPackagePage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function jsonLdScripts() {
  return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((script) => script.textContent ?? '')
    .join('\n');
}

describe('StartupPackagePage redesign', () => {
  it('presents a verified startup-lab offer and preserves modal conversion paths', async () => {
    const user = userEvent.setup();
    renderStartupPackage();

    expect(
      screen.getByRole('heading', { name: /Startup lab equipment packages for new research programs/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/2-year standard warranty/i).length).toBeGreaterThanOrEqual(1);

    const body = document.body;
    expect(body).not.toHaveTextContent(/2–3 years warranty/i);
    expect(body).not.toHaveTextContent(/2-3 years warranty/i);
    expect(body).not.toHaveTextContent(/extended warranty/i);
    expect(body).not.toHaveTextContent(/free installation and training/i);
    expect(body).not.toHaveTextContent(/300 research institutions/i);
    expect(body).not.toHaveTextContent(/Over 300/i);
    expect(body).not.toHaveTextContent(/STARTUP PACKAGE 2025/i);

    expect(screen.getByRole('link', { name: /ICP-RIE \/ RIE/i })).toHaveAttribute('href', '/products/icp-etcher');
    expect(screen.getByRole('link', { name: /PECVD \/ ALD/i })).toHaveAttribute('href', '/products/pecvd');
    expect(screen.getByRole('link', { name: /Coater \/ Developer/i })).toHaveAttribute(
      'href',
      '/products/coater-developer'
    );

    await user.click(screen.getByRole('button', { name: /Request Startup Package Quote/i }));
    expect(screen.getByRole('dialog', { name: /quote modal/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Close Quote/i }));
    await user.click(screen.getByRole('button', { name: /Download Equipment Guide/i }));

    const gate = screen.getByRole('dialog', { name: /download gate/i });
    expect(gate).toHaveAttribute('data-file-url', '/NineScrolls-Equipment-Guide.pdf');
    expect(gate).toHaveAttribute('data-file-name', 'NineScrolls-Equipment-Guide.pdf');

    await waitFor(() => {
      const schema = jsonLdScripts();
      expect(schema).toContain('Startup Package');
      expect(schema).not.toMatch(/2–3 years warranty|free installation and training|300 research institutions|extended warranty/i);
    });
  });
});
