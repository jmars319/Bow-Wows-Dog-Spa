import { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function RichTextEditor({ value, onChange }) {
  const modules = useMemo(
    () => ({
      toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']],
    }),
    [],
  );

  return <ReactQuill theme="snow" value={value} onChange={onChange} modules={modules} />;
}
