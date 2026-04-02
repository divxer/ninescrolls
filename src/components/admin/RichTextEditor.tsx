import { useState, useRef, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';

// Self-hosted TinyMCE: import core, theme, model, icons, and plugins
import 'tinymce/tinymce';
import 'tinymce/themes/silver';
import 'tinymce/models/dom';
import 'tinymce/icons/default';

import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/link';
import 'tinymce/plugins/image';
import 'tinymce/plugins/charmap';
import 'tinymce/plugins/preview';
import 'tinymce/plugins/anchor';
import 'tinymce/plugins/searchreplace';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/code';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/insertdatetime';
import 'tinymce/plugins/media';
import 'tinymce/plugins/table';
import 'tinymce/plugins/autoresize';

// Import skin CSS directly (avoids needing static file copy)
import 'tinymce/skins/ui/oxide/skin.min.css';

import { getImageUploadUrl, uploadImageToS3, processImage } from '../../services/insightsImageService';

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
  const editorRef = useRef<any>(null);

  const handleImageUpload = useCallback(
    (cb: (url: string, meta?: Record<string, string>) => void) => {
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
          alert('Unsupported file type. Allowed: JPEG, PNG, WebP');
          return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
          alert('File too large (max 10MB)');
          return;
        }

        setUploading(true);
        try {
          // Upload to temp/ then process (resize + WebP) via Lambda
          const { uploadUrl, s3Key } = await getImageUploadUrl(slug, `content-${file.name}`, file.type);
          await uploadImageToS3(uploadUrl, file);
          const result = await processImage(s3Key, slug);
          const cdnUrl = `${result.cdnBaseUrl}/insights/${slug}/${result.heroPrefix}-lg.webp`;
          cb(cdnUrl, { alt: file.name });
        } catch (err) {
          alert(`Image upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
          setUploading(false);
        }
      };
      input.click();
    },
    [slug],
  );

  return (
    <div>
      <div className="flex gap-2 border-b border-outline-variant/20 pb-3 mb-4">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!isSourceMode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
          onClick={() => setIsSourceMode(false)}
        >
          Visual
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSourceMode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
          onClick={() => setIsSourceMode(true)}
        >
          HTML Source
        </button>
      </div>
      {uploading && (
        <div className="text-secondary text-xs font-medium mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
          Uploading image...
        </div>
      )}
      {isSourceMode ? (
        <textarea
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = Math.max(600, el.scrollHeight) + 'px';
            }
          }}
          className="w-full bg-surface-container-low border-none rounded-lg p-4 text-xs font-mono text-on-surface focus:ring-1 focus:ring-secondary/30 resize-none"
          value={value}
          onChange={(e) => {
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = Math.max(600, el.scrollHeight) + 'px';
            onChange(el.value);
          }}
          placeholder={placeholder}
        />
      ) : (
        <Editor
          onInit={(_evt, editor) => {
            editorRef.current = editor;
          }}
          value={value}
          onEditorChange={(newValue) => onChange(newValue.replace(/\u00a0/g, ' '))}
          init={{
            skin: false,
            content_css: false,
            content_style: `
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 0.95rem;
                line-height: 1.6;
                padding: 8px 12px;
                margin: 0;
                color: #1a1c1c;
              }
              table { border-collapse: collapse; width: 100%; margin: 1em 0; }
              table td, table th { border: 1px solid #c4c6cf; padding: 8px 10px; }
              table th { background: #f3f3f3; font-weight: 600; }
              img { max-width: 100%; height: auto; }
              blockquote { border-left: 3px solid #c4c6cf; margin: 1em 0; padding: 0.5em 1em; color: #43474e; }
              pre { background: #f3f3f3; padding: 1em; border-radius: 6px; overflow-x: auto; }
            `,

            min_height: 600,
            autoresize_bottom_margin: 50,
            menubar: false,
            placeholder: placeholder || '',

            document_base_url: window.location.origin + '/',
            relative_urls: false,
            convert_urls: false,

            plugins: [
              'advlist', 'autolink', 'lists', 'link', 'image',
              'charmap', 'preview', 'anchor', 'searchreplace',
              'visualblocks', 'code', 'fullscreen',
              'insertdatetime', 'media', 'table', 'autoresize',
            ],

            toolbar:
              'blocks | bold italic underline strikethrough | ' +
              'alignleft aligncenter alignright alignjustify | ' +
              'bullist numlist | blockquote code | ' +
              'link image table | removeformat',

            block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4',

            entity_encoding: 'raw' as const,

            valid_elements: '*[*]',
            extended_valid_elements: 'th[*],td[*],tr[*],thead[*],tbody[*],table[*]',

            file_picker_types: 'image',
            file_picker_callback: handleImageUpload,

            table_default_attributes: {
              border: '1',
            },
            table_default_styles: {
              'border-collapse': 'collapse',
              'width': '100%',
            },

            forced_root_block: 'p' as const,
            branding: false,
            promotion: false,
          }}
        />
      )}
    </div>
  );
}
