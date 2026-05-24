import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cleanPastedRichText,
  normalizeRichText,
  normalizeRichTextUrl,
  plainTextToRichText,
  sanitizeRichText,
} from './utils/richText';

const MAX_HISTORY = 60;

function queryState(command) {
  try {
    return Boolean(document.queryCommandState?.(command));
  } catch {
    return false;
  }
}

function hasSelection() {
  const selection = window.getSelection?.();
  return Boolean(selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed);
}

export default function RichTextEditor({ value = '', onChange }) {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const focusedRef = useRef(false);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const [html, setHtml] = useState(() => normalizeRichText(value));
  const [previewOpen, setPreviewOpen] = useState(false);
  const [format, setFormat] = useState('p');
  const [active, setActive] = useState({ bold: false, italic: false, unorderedList: false, orderedList: false, link: false });
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1,
    });
  }, []);

  const resetHistory = useCallback((nextHtml) => {
    historyRef.current = [nextHtml];
    historyIndexRef.current = 0;
    updateHistoryState();
  }, [updateHistoryState]);

  const recordHistory = useCallback((nextHtml) => {
    if (historyRef.current[historyIndexRef.current] === nextHtml) {
      updateHistoryState();
      return;
    }
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(nextHtml);
    if (next.length > MAX_HISTORY) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    updateHistoryState();
  }, [updateHistoryState]);

  const saveSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection?.();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const selection = window.getSelection?.();
    if (!selection || !selectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  }, []);

  const refreshActiveState = useCallback(() => {
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const anchor = range?.commonAncestorContainer;
    const editor = editorRef.current;
    const element = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    const closest = (selector) => (element && editor?.contains(element) ? element.closest(selector) : null);
    setActive({
      bold: queryState('bold') || Boolean(closest('strong,b')),
      italic: queryState('italic') || Boolean(closest('em,i')),
      unorderedList: queryState('insertUnorderedList') || Boolean(closest('ul')),
      orderedList: queryState('insertOrderedList') || Boolean(closest('ol')),
      link: Boolean(closest('a')),
    });
    setFormat(closest('h3') ? 'h3' : 'p');
  }, []);

  const commitHtml = useCallback((rawHtml, keepHistory = true) => {
    const next = sanitizeRichText(rawHtml);
    setHtml(next);
    if (editorRef.current && editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next;
    }
    if (keepHistory) recordHistory(next);
    onChange?.(next);
    refreshActiveState();
  }, [onChange, recordHistory, refreshActiveState]);

  useEffect(() => {
    if (focusedRef.current) return;
    const next = normalizeRichText(value);
    setHtml(next);
    if (editorRef.current && editorRef.current.innerHTML !== next) {
      editorRef.current.innerHTML = next;
    }
    resetHistory(next);
  }, [resetHistory, value]);

  useEffect(() => {
    const handler = () => {
      if (focusedRef.current) refreshActiveState();
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [refreshActiveState]);

  const exec = useCallback((command, valueArg = null) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand?.(command, false, valueArg);
    commitHtml(editorRef.current?.innerHTML || '');
    saveSelection();
  }, [commitHtml, restoreSelection, saveSelection]);

  const moveHistory = useCallback((direction) => {
    const nextIndex = historyIndexRef.current + direction;
    if (nextIndex < 0 || nextIndex >= historyRef.current.length) return;
    historyIndexRef.current = nextIndex;
    const next = historyRef.current[nextIndex] || '';
    setHtml(next);
    if (editorRef.current) editorRef.current.innerHTML = next;
    onChange?.(next);
    updateHistoryState();
    refreshActiveState();
  }, [onChange, refreshActiveState, updateHistoryState]);

  const handleLink = () => {
    editorRef.current?.focus();
    restoreSelection();
    const current = window.getSelection?.()?.anchorNode?.parentElement?.closest?.('a');
    const entered = window.prompt('Enter a link URL, email, phone number, or page anchor.', current?.getAttribute('href') || '');
    if (entered === null) return;
    const href = normalizeRichTextUrl(entered);
    exec(href ? 'createLink' : 'unlink', href || null);
  };

  const clearFormatting = () => {
    if (hasSelection()) {
      exec('removeFormat');
      exec('unlink');
      return;
    }
    commitHtml(plainTextToRichText(editorRef.current?.textContent || ''));
  };

  const buttonClass = (isActive = false) => `rich-text-toolbar-button${isActive ? ' is-active' : ''}`;

  return (
    <div className="rich-text-editor-shell">
      <div className="rich-text-toolbar" aria-label="Rich text formatting">
        <button type="button" className={buttonClass()} disabled={!historyState.canUndo} onMouseDown={(event) => event.preventDefault()} onClick={() => moveHistory(-1)}>Undo</button>
        <button type="button" className={buttonClass()} disabled={!historyState.canRedo} onMouseDown={(event) => event.preventDefault()} onClick={() => moveHistory(1)}>Redo</button>
        <select value={format} aria-label="Text format" onMouseDown={saveSelection} onChange={(event) => exec('formatBlock', event.target.value)}>
          <option value="p">Paragraph</option>
          <option value="h3">Small Heading</option>
        </select>
        <button type="button" className={buttonClass(active.bold)} onMouseDown={(event) => event.preventDefault()} onClick={() => exec('bold')}>B</button>
        <button type="button" className={buttonClass(active.italic)} onMouseDown={(event) => event.preventDefault()} onClick={() => exec('italic')}>I</button>
        <button type="button" className={buttonClass(active.unorderedList)} onMouseDown={(event) => event.preventDefault()} onClick={() => exec('insertUnorderedList')}>Bullet list</button>
        <button type="button" className={buttonClass(active.orderedList)} onMouseDown={(event) => event.preventDefault()} onClick={() => exec('insertOrderedList')}>Numbered list</button>
        <button type="button" className={buttonClass(active.link)} onMouseDown={(event) => event.preventDefault()} onClick={handleLink}>Link</button>
        <button type="button" className={buttonClass()} onMouseDown={(event) => event.preventDefault()} onClick={() => exec('unlink')}>Unlink</button>
        <button type="button" className={buttonClass()} onMouseDown={(event) => event.preventDefault()} onClick={clearFormatting}>Clear formatting</button>
        <button type="button" className={buttonClass(previewOpen)} onMouseDown={saveSelection} onClick={() => setPreviewOpen((prev) => !prev)}>
          {previewOpen ? 'Hide preview' : 'Preview'}
        </button>
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        className="rich-text-editor"
        contentEditable
        suppressContentEditableWarning
        onFocus={() => {
          focusedRef.current = true;
          refreshActiveState();
        }}
        onBlur={() => {
          focusedRef.current = false;
          saveSelection();
          commitHtml(editorRef.current?.innerHTML || '');
        }}
        onInput={() => commitHtml(editorRef.current?.innerHTML || '')}
        onMouseUp={() => {
          saveSelection();
          refreshActiveState();
        }}
        onKeyUp={refreshActiveState}
        onPaste={(event) => {
          event.preventDefault();
          const pasted = cleanPastedRichText({
            html: event.clipboardData.getData('text/html'),
            text: event.clipboardData.getData('text/plain'),
          });
          exec('insertHTML', pasted);
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {previewOpen && (
        <div className="rich-text-preview" aria-label="Preview">
          <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />
        </div>
      )}
    </div>
  );
}
