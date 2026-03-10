import { useState, useRef } from 'react';
import { Modal } from './Modal';
import {
  FORWARD_PATH, STATUS_LABELS, DOCUMENT_TYPES, DOC_TYPE_LABELS,
  type OrderStatus, type DocumentType,
} from '../../types/admin';
import * as svc from '../../services/orderAdminService';

interface UploadDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  currentStatus: OrderStatus;
  onSuccess: () => void;
}

export function UploadDocumentDialog({ open, onClose, orderId, currentStatus, onSuccess }: UploadDocumentDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<string>(currentStatus);
  const [docType, setDocType] = useState<DocumentType>('OTHER');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  async function handleUpload() {
    if (!file) { setError('Please select a file.'); return; }
    setUploading(true);
    setError('');
    try {
      // 1. Get presigned URL
      setProgress('Getting upload URL...');
      const urlData = await svc.getDocumentUploadUrl(orderId, file.name, file.type);
      if (!urlData) throw new Error('Failed to get upload URL');

      const { uploadUrl, s3Key } = urlData as { uploadUrl: string; s3Key: string };

      // 2. Upload to S3
      setProgress('Uploading file...');
      await svc.uploadFileToS3(uploadUrl, file);

      // 3. Confirm upload
      setProgress('Confirming upload...');
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      await svc.confirmDocumentUpload({
        orderId,
        s3Key,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        stage,
        docType,
        description: description || undefined,
        tags: tagList.length > 0 ? tagList : undefined,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress('');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload Document">
      {error && <div className="admin-error">{error}</div>}
      {progress && <div style={{ color: '#2563eb', marginBottom: '12px' }}>{progress}</div>}

      {/* Drop zone */}
      <div
        className="admin-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {file ? (
          <div>
            <strong>{file.name}</strong>
            <div style={{ fontSize: '0.85em', color: '#666' }}>
              {(file.size / 1024).toFixed(1)} KB - {file.type}
            </div>
          </div>
        ) : (
          <div>
            <div>Drag & drop a file here, or click to browse</div>
            <div style={{ fontSize: '0.85em', color: '#999' }}>PDF, images, Word, Excel up to 50MB</div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      <div className="form-field">
        <label>Stage</label>
        <select value={stage} onChange={(e) => setStage(e.target.value)}
          className="admin-filter-select" style={{ width: '100%' }}>
          {FORWARD_PATH.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Document Type</label>
        <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}
          className="admin-filter-select" style={{ width: '100%' }}>
          {DOCUMENT_TYPES.map(dt => (
            <option key={dt} value={dt}>{DOC_TYPE_LABELS[dt]}</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          rows={2} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
      </div>

      <div className="form-field">
        <label>Tags (comma separated)</label>
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. final, signed" className="admin-search-input" style={{ width: '100%' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button className="admin-btn-sm admin-btn-outline" onClick={onClose} disabled={uploading}>Cancel</button>
        <button className="admin-btn-primary" onClick={handleUpload} disabled={uploading || !file}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </Modal>
  );
}
