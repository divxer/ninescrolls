import { QuoteModal } from '../common/QuoteModal';
import { downloadFile } from '../../utils/downloadFile';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface ProductQuoteModalProps {
  isOpen: boolean;
  defaultIsQuote: boolean;
  onClose: () => void;
  productName: string;
  /** Datasheet/brochure to offer in the modal. Omit if the product has none. */
  brochureHref?: string;
  brochureFilename?: string;
  downloadLabel?: string;
  /** Close the modal before downloading (matches the original behavior of the
   *  plasma-cleaner pages). */
  closeOnDownload?: boolean;
}

/**
 * Product-page wrapper around QuoteModal: supplies the (uniform) Turnstile site
 * key and wires the datasheet download, so each product page only passes its
 * own name + brochure info.
 */
export function ProductQuoteModal({
  isOpen,
  defaultIsQuote,
  onClose,
  productName,
  brochureHref,
  brochureFilename,
  downloadLabel,
  closeOnDownload = false,
}: ProductQuoteModalProps) {
  const analytics = useCombinedAnalytics();
  const handleDownload = brochureHref
    ? () => {
        if (closeOnDownload) onClose();
        downloadFile(brochureHref, brochureFilename ?? '');
        // Attribute the download to this product page. trackCustomEvent stores a
        // pdf_download AnalyticsEvent with the current pathname + productName, so
        // it counts in the admin Products "Downloads" metric.
        analytics.trackCustomEvent('Datasheet Downloaded', {
          productId: productName,
          productName,
          fileName: brochureFilename,
          origin: 'Product Quote Modal',
        });
      }
    : undefined;

  return (
    <QuoteModal
      isOpen={isOpen}
      defaultIsQuote={defaultIsQuote}
      onClose={onClose}
      productName={productName}
      downloadLabel={downloadLabel}
      turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
      onDownloadBrochure={handleDownload}
    />
  );
}
