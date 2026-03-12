import { useState, useRef, useCallback, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { getContentImageUploadUrl, uploadImageToS3 } from '../../services/insightsImageService';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  slug?: string;
}

export function RichTextEditor({ value, onChange, placeholder, slug }: RichTextEditorProps) {
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const quillRef = useRef<ReactQuill>(null);

  const imageHandler = useCallback(() => {
    if (!slug) {
      alert('Please set the article slug before uploading images.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ALLOWED_IMAGE_TYPES.join(',');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        alert(`Unsupported file type. Allowed: JPEG, PNG, WebP`);
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        alert(`File too large (max 10MB)`);
        return;
      }

      const quill = quillRef.current?.getEditor();
      if (!quill) return;

      setUploading(true);
      try {
        const { uploadUrl, cdnUrl } = await getContentImageUploadUrl(slug, file.name, file.type);
        await uploadImageToS3(uploadUrl, file);

        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', cdnUrl);
        quill.setSelection(range.index + 1, 0);
      } catch (err) {
        alert(`Image upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [slug]);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, 4, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        [{ align: [] }],
        ['clean'],
      ],
      handlers: {
        image: imageHandler,
      },
    },
  }), [imageHandler]);

  return (
    <div className="rich-text-editor">
      <div className="rich-text-editor-toggle">
        <button
          type="button"
          className={`editor-mode-btn ${!isSourceMode ? 'active' : ''}`}
          onClick={() => setIsSourceMode(false)}
        >
          Visual
        </button>
        <button
          type="button"
          className={`editor-mode-btn ${isSourceMode ? 'active' : ''}`}
          onClick={() => setIsSourceMode(true)}
        >
          HTML Source
        </button>
      </div>
      {uploading && (
        <div className="editor-upload-indicator">Uploading image...</div>
      )}
      {isSourceMode ? (
        <textarea
          className="html-source-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={20}
        />
      ) : (
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
