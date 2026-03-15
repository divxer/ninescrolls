import { Modal } from './Modal';
import type { OrderDocument } from '../../types/admin';

interface PreviewModalProps {
  doc: OrderDocument;
  onClose: () => void;
}

export function PreviewModal({ doc, onClose }: PreviewModalProps) {
  const url = doc.previewUrl || doc.downloadUrl;

  return (
    <Modal open onClose={onClose} title={doc.fileName} className="admin-modal-wide">
      <div style={{ minHeight: '400px' }}>
        {doc.mimeType.includes('pdf') && url ? (
          <iframe
            src={url}
            style={{ width: '100%', height: '80vh', border: 'none' }}
            title={doc.fileName}
          />
        ) : doc.mimeType.includes('image') && url ? (
          <img
            src={url}
            alt={doc.fileName}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Preview not available for this file type.</p>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="admin-btn-primary">
                Download File
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
