import { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    [{ align: [] }],
    ['clean'],
  ],
};

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [isSourceMode, setIsSourceMode] = useState(false);

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
