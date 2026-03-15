import { useState, useMemo, useRef, useEffect } from 'react';
import { useOrderDocuments } from '../../hooks/useOrders';
import { StatusBadge } from './StatusBadge';
import { UploadDocumentDialog } from './UploadDocumentDialog';
import { PreviewModal } from './PreviewModal';
import {
  STATUS_LABELS, FORWARD_PATH,
  formatFileSize, formatDateTime,
  type OrderStatus, type OrderDocument,
} from '../../types/admin';
import * as svc from '../../services/orderAdminService';

/** Dropdown menu for document actions. */
function DocMenu({ onDelete, deleting }: { onDelete: () => void; deleting: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="contact-menu-wrapper">
      <button
        className="contact-menu-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Document actions"
      >⋯</button>
      {open && (
        <div className="contact-menu-dropdown">
          <button
            className="contact-menu-item contact-menu-item-danger"
            onClick={() => { setOpen(false); onDelete(); }}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
}

interface DocumentsPanelProps {
  orderId: string;
  currentStatus: OrderStatus;
}

export function DocumentsPanel({ orderId, currentStatus }: DocumentsPanelProps) {
  const { documents, loading, error, refresh } = useOrderDocuments(orderId);
  const [activeStage, setActiveStage] = useState<string>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<OrderDocument | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Stages that have documents
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      counts[doc.stage] = (counts[doc.stage] || 0) + 1;
    }
    return counts;
  }, [documents]);

  const stages = useMemo(() => {
    return FORWARD_PATH.filter(s => stageCounts[s]);
  }, [stageCounts]);

  const filteredDocs = useMemo(() => {
    if (activeStage === 'all') return documents;
    return documents.filter(d => d.stage === activeStage);
  }, [documents, activeStage]);

  async function handleDelete(doc: OrderDocument) {
    if (!window.confirm(`Delete "${doc.fileName}"?`)) return;
    setDeleting(doc.docId);
    try {
      await svc.deleteDocument(orderId, doc.docId);
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  }

  function getMimeIcon(mime: string) {
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('image')) return '🖼️';
    if (mime.includes('word') || mime.includes('document')) return '📝';
    if (mime.includes('sheet') || mime.includes('excel')) return '📊';
    return '📎';
  }

  if (loading) return <div className="admin-loading">Loading documents...</div>;
  if (error) return <div className="admin-error">Error loading documents: {error.message}</div>;

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3>Documents ({documents.length})</h3>
        <button className="admin-btn-sm" onClick={() => setShowUpload(true)}>
          Upload Document
        </button>
      </div>

      {/* Stage Tabs */}
      {stages.length > 0 && (
        <div className="admin-stage-tabs">
          <button
            className={`admin-stage-tab ${activeStage === 'all' ? 'active' : ''}`}
            onClick={() => setActiveStage('all')}
          >
            All ({documents.length})
          </button>
          {stages.map(stage => (
            <button
              key={stage}
              className={`admin-stage-tab ${activeStage === stage ? 'active' : ''}`}
              onClick={() => setActiveStage(stage)}
            >
              {STATUS_LABELS[stage]} ({stageCounts[stage]})
            </button>
          ))}
        </div>
      )}

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <p className="admin-empty">
          {documents.length === 0
            ? 'No documents yet. Upload the first one.'
            : 'No documents in this stage.'}
        </p>
      ) : (
        <div className="admin-doc-list">
          {filteredDocs.map(doc => (
            <div key={doc.docId} className="admin-doc-row">
              <div className="admin-doc-icon">{getMimeIcon(doc.mimeType)}</div>
              <div className="admin-doc-info">
                <div className="admin-doc-name">{doc.fileName}</div>
                <div className="admin-doc-meta">
                  <StatusBadge status={doc.docType} />
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <span>{formatDateTime(doc.uploadedAt)}</span>
                  <span>{doc.uploadedBy}</span>
                </div>
                {doc.description && <div className="admin-doc-desc">{doc.description}</div>}
                {doc.tags && doc.tags.length > 0 && (
                  <div className="admin-doc-tags">
                    {doc.tags.map(tag => (
                      <span key={tag} className="admin-doc-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="admin-doc-actions">
                {(doc.mimeType.includes('pdf') || doc.mimeType.includes('image')) && doc.previewUrl && (
                  <button className="admin-btn-sm admin-btn-outline" onClick={() => setPreviewDoc(doc)}>
                    Preview
                  </button>
                )}
                {doc.downloadUrl && (
                  <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer" className="admin-btn-sm admin-btn-outline">
                    Download
                  </a>
                )}
                <DocMenu
                  onDelete={() => handleDelete(doc)}
                  deleting={deleting === doc.docId}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadDocumentDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          orderId={orderId}
          currentStatus={currentStatus}
          onSuccess={() => { setShowUpload(false); refresh(); }}
        />
      )}

      {previewDoc && (
        <PreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
