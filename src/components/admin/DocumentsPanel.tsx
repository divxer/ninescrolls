import { useState, useMemo, useRef, useEffect } from 'react';
import { useOrderDocuments } from '../../hooks/useOrders';
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
    <div ref={ref} className="relative">
      <button
        className="p-2.5 rounded-lg hover:bg-surface-container-low transition-colors bg-transparent border-none cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-label="Document actions"
      >
        <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-surface-container-lowest rounded-xl shadow-[0px_10px_30px_rgba(2,36,72,0.12)] py-1.5 z-50 min-w-[160px]">
            <button
              className="w-full text-left px-4 py-2.5 text-xs font-medium text-error bg-transparent hover:bg-error-container/30 transition-colors flex items-center gap-3 border-none"
              onClick={() => { setOpen(false); onDelete(); }}
              disabled={deleting}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface DocumentsPanelProps {
  orderId: string;
  currentStatus: OrderStatus;
}

function getMimeIcon(mime: string): { icon: string; bgClass: string; textClass: string } {
  if (mime.includes('pdf')) return { icon: 'description', bgClass: 'bg-red-50', textClass: 'text-red-600' };
  if (mime.includes('image')) return { icon: 'image', bgClass: 'bg-blue-50', textClass: 'text-blue-600' };
  if (mime.includes('sheet') || mime.includes('excel')) return { icon: 'table_chart', bgClass: 'bg-green-50', textClass: 'text-green-600' };
  return { icon: 'attach_file', bgClass: 'bg-surface-container', textClass: 'text-on-surface-variant' };
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

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
        <p className="text-sm text-on-surface-variant">Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
        <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm">
          Error loading documents: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold tracking-wider text-primary uppercase">Documentation</h3>
          <button
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-container text-on-primary-container rounded-lg text-xs font-bold hover:brightness-110 transition-all"
            onClick={() => setShowUpload(true)}
          >
            <span className="material-symbols-outlined text-sm">upload</span>
            <span>Upload</span>
          </button>
        </div>

        {/* Stage Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors border-none cursor-pointer ${
              activeStage === 'all'
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
            }`}
            onClick={() => setActiveStage('all')}
          >
            All{documents.length > 0 ? ` (${documents.length})` : ''}
          </button>
          {stages.map(stage => (
            <button
              key={stage}
              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors border-none cursor-pointer ${
                activeStage === stage
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
              onClick={() => setActiveStage(stage)}
            >
              {STATUS_LABELS[stage]} ({stageCounts[stage]})
            </button>
          ))}
        </div>

        {/* Document List */}
        <div className="space-y-4">
          {filteredDocs.length === 0 ? (
            <div className="w-full py-3 border-2 border-dashed border-outline-variant rounded-lg text-center">
              <p className="text-xs font-bold text-on-surface-variant">
                {documents.length === 0
                  ? 'No documents yet. Upload the first one.'
                  : 'No documents in this stage.'}
              </p>
            </div>
          ) : (
            filteredDocs.map(doc => {
              const { icon, bgClass, textClass } = getMimeIcon(doc.mimeType);
              return (
                <div
                  key={doc.docId}
                  className="flex items-start gap-3 p-3 rounded-lg border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => {
                    if ((doc.mimeType.includes('pdf') || doc.mimeType.includes('image')) && doc.previewUrl) {
                      setPreviewDoc(doc);
                    } else if (doc.downloadUrl) {
                      window.open(doc.downloadUrl, '_blank');
                    }
                  }}
                >
                  <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${bgClass} ${textClass}`}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{doc.fileName}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      {formatDateTime(doc.uploadedAt)} &middot; {formatFileSize(doc.fileSize)}
                    </p>
                    {doc.description && (
                      <p className="text-[10px] text-on-surface-variant mt-1 truncate">{doc.description}</p>
                    )}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {doc.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-medium bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DocMenu
                      onDelete={() => handleDelete(doc)}
                      deleting={deleting === doc.docId}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
