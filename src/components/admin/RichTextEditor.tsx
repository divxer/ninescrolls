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
          const { uploadUrl, cdnUrl } = await getContentImageUploadUrl(slug, file.name, file.type);
          await uploadImageToS3(uploadUrl, file);
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
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = Math.max(600, el.scrollHeight) + 'px';
            }
          }}
          className="html-source-editor"
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 0.95rem;
                line-height: 1.6;
                padding: 8px 12px;
                margin: 0;
                color: #333;
              }
              table { border-collapse: collapse; width: 100%; margin: 1em 0; }
              table td, table th { border: 1px solid #ccc; padding: 8px 10px; }
              table th { background: #f5f5f5; font-weight: 600; }
              img { max-width: 100%; height: auto; }
              blockquote { border-left: 3px solid #ccc; margin: 1em 0; padding: 0.5em 1em; color: #666; }
              pre { background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; }
            `,

            min_height: 600,
            autoresize_bottom_margin: 50,
            menubar: false,
            placeholder: placeholder || '',

            // Resolve relative image paths inside the editor iframe
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

            // Prevent &nbsp; between words
            entity_encoding: 'raw' as const,

            // Preserve all HTML elements and attributes (tables, th, inline styles)
            valid_elements: '*[*]',
            extended_valid_elements: 'th[*],td[*],tr[*],thead[*],tbody[*],table[*]',

            // Image upload
            file_picker_types: 'image',
            file_picker_callback: handleImageUpload,

            // Table defaults
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
