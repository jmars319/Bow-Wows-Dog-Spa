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
  const [draggedIndex, setDraggedIndex] = useState(null);

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

  const duplicateItem = (index) => {
    const next = [...items];
    next.splice(index + 1, 0, { ...items[index] });
    onChange(next);
  };

  const moveItem = (index, offset) => {
    const nextIndex = Math.max(0, Math.min((items || []).length - 1, index + offset));
    if (nextIndex === index) {
      return;
    }
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  };

  const dropItem = (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    const next = [...items];
    const [item] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, item);
    onChange(next);
    setDraggedIndex(null);
  };

  return (
    <div className="stack gap-sm">
      {items?.map((item, index) => (
        <div
          key={index}
          className="list-editor-row"
          draggable
          onDragStart={() => setDraggedIndex(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => dropItem(index)}
        >
          <div className="sort-tools">
            <span className="sort-tools__handle" aria-hidden="true">Drag</span>
            <button type="button" className="btn btn-link" onClick={() => moveItem(index, -1)} disabled={index === 0}>
              Move up
            </button>
            <button type="button" className="btn btn-link" onClick={() => moveItem(index, 1)} disabled={index >= (items || []).length - 1}>
              Move down
            </button>
          </div>
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
          <button type="button" className="btn btn-link" onClick={() => duplicateItem(index)}>
            Duplicate
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-tertiary" onClick={addItem}>
        Add item
      </button>
    </div>
  );
}
