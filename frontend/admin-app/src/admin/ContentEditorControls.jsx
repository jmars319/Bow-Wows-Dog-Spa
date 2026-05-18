import { Suspense, lazy, useState } from 'react';

const RichTextEditorImpl = lazy(() => import('../RichTextEditor'));

export function RichTextEditor({ value, onChange }) {
  return (
    <Suspense fallback={<div className="rich-text-loading muted small-text">Loading editor…</div>}>
      <RichTextEditorImpl value={value} onChange={onChange} />
    </Suspense>
  );
}

export function EditorSection({ title, description, children, initiallyOpen = false }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const sectionKey = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <details
      className="editor-section card"
      data-editor-section={sectionKey}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <div>
          <strong>{title}</strong>
          {description && <p className="muted small-text">{description}</p>}
        </div>
      </summary>
      <div className="editor-section__body stack gap-sm">{children}</div>
    </details>
  );
}

export function SectionEnabledToggle({ label, value, onChange }) {
  return (
    <label className="section-toggle">
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function ListEditor({ items, onChange, fields }) {
  const addItem = () => {
    const blank = {};
    fields.forEach((field) => {
      blank[field.name] = '';
    });
    onChange([...(items || []), blank]);
  };

  const updateItem = (index, key, value) => {
    const next = [...items];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const removeItem = (index) => {
    const next = [...items];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className="stack gap-sm">
      {items?.map((item, index) => (
        <div key={index} className="list-editor-row">
          {fields.map((field) =>
            field.rich ? (
              <div key={field.name} className="field-block">
                <span className="field-label">{field.label}</span>
                <RichTextEditor value={item[field.name] || ''} onChange={(value) => updateItem(index, field.name, value)} />
              </div>
            ) : (
              <label key={field.name} className="field-block">
                <span className="field-label">{field.label}</span>
                <input
                  placeholder={field.label}
                  value={item[field.name] || ''}
                  onChange={(e) => updateItem(index, field.name, e.target.value)}
                />
              </label>
            ),
          )}
          <button type="button" className="btn btn-link danger" onClick={() => removeItem(index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-tertiary" onClick={addItem}>
        Add item
      </button>
    </div>
  );
}
