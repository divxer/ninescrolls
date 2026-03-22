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
      {error && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      {progress && (
        <p className="text-secondary text-sm mb-3">{progress}</p>
      )}

      {/* Drop zone */}
      <div
        className="w-full py-8 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-secondary transition-all mb-5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {file ? (
          <div className="p-4 bg-surface-container-low rounded-lg text-center">
            <p className="text-xs font-bold text-on-surface">{file.name}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">
              {(file.size / 1024).toFixed(1)} KB &middot; {file.type}
            </p>
          </div>
        ) : (
          <>
            <span className="material-symbols-outlined text-outline-variant text-4xl mb-2">cloud_upload</span>
            <p className="text-xs font-bold text-on-surface">Drag & drop a file here, or click to browse</p>
            <p className="text-[10px] text-on-surface-variant mt-1">PDF, images, Word, Excel up to 50MB</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Stage
          </label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          >
            {FORWARD_PATH.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Document Type
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          >
            {DOCUMENT_TYPES.map(dt => (
              <option key={dt} value={dt}>{DOC_TYPE_LABELS[dt]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. final, signed"
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <button
          className="border border-outline-variant text-on-surface px-4 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-low transition-colors"
          onClick={onClose}
          disabled={uploading}
        >
          Cancel
        </button>
        <button
          className="bg-secondary text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-secondary/90 transition-colors disabled:opacity-50"
          onClick={handleUpload}
          disabled={uploading || !file}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </Modal>
  );
}
