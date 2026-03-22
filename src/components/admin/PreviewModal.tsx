import { Modal } from './Modal';
import type { OrderDocument } from '../../types/admin';

interface PreviewModalProps {
  doc: OrderDocument;
  onClose: () => void;
}

export function PreviewModal({ doc, onClose }: PreviewModalProps) {
  const url = doc.previewUrl || doc.downloadUrl;

  return (
    <Modal open onClose={onClose} title={doc.fileName} className="!max-w-4xl">
      <div className="min-h-[60vh]">
        {doc.mimeType.includes('pdf') && url ? (
          <iframe
            src={url}
            className="w-full h-[70vh] border-none"
            title={doc.fileName}
          />
        ) : doc.mimeType.includes('image') && url ? (
          <img
            src={url}
            alt={doc.fileName}
            className="max-w-full max-h-[80vh] object-contain p-5 mx-auto block"
          />
        ) : (
          <div className="text-center py-10">
            <p className="text-sm text-on-surface-variant mb-4">Preview not available for this file type.</p>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Download File
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
