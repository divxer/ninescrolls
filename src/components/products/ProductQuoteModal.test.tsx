import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const { downloadFile } = vi.hoisted(() => ({ downloadFile: vi.fn() }));
const captured = vi.hoisted(() => ({ props: null as { onDownloadBrochure?: () => void; productName?: string } | null }));

// Capture the props ProductQuoteModal passes down, without rendering the real modal.
vi.mock('../common/QuoteModal', () => ({
  QuoteModal: (props: { onDownloadBrochure?: () => void; productName?: string }) => {
    captured.props = props;
    return null;
  },
}));
vi.mock('../../utils/downloadFile', () => ({ downloadFile }));

import { ProductQuoteModal } from './ProductQuoteModal';

describe('ProductQuoteModal', () => {
  beforeEach(() => {
    downloadFile.mockClear();
    captured.props = null;
  });

  it('downloads via downloadFile and does NOT close when closeOnDownload is unset', () => {
    const onClose = vi.fn();
    render(
      <ProductQuoteModal
        isOpen defaultIsQuote={false} onClose={onClose}
        productName="PLUTO-F" brochureHref="/docs/pluto-f.pdf" brochureFilename="NineScrolls-PLUTO-F.pdf"
      />,
    );
    expect(captured.props?.productName).toBe('PLUTO-F');
    captured.props?.onDownloadBrochure?.();
    expect(downloadFile).toHaveBeenCalledWith('/docs/pluto-f.pdf', 'NineScrolls-PLUTO-F.pdf');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes the modal before downloading when closeOnDownload is set', () => {
    const onClose = vi.fn();
    render(
      <ProductQuoteModal
        isOpen defaultIsQuote={false} onClose={onClose}
        productName="HY-4L" brochureHref="/NineScrolls-Equipment-Guide.pdf" brochureFilename="NineScrolls-Equipment-Guide.pdf"
        closeOnDownload
      />,
    );
    captured.props?.onDownloadBrochure?.();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledWith('/NineScrolls-Equipment-Guide.pdf', 'NineScrolls-Equipment-Guide.pdf');
  });

  it('omits onDownloadBrochure when no brochure is provided', () => {
    render(
      <ProductQuoteModal isOpen defaultIsQuote={false} onClose={vi.fn()} productName="X" />,
    );
    expect(captured.props?.onDownloadBrochure).toBeUndefined();
  });
});
