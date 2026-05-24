import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from './RichTextEditor';

describe('RichTextEditor', () => {
  let originalExecCommand;

  beforeEach(() => {
    originalExecCommand = document.execCommand;
    document.execCommand = vi.fn((command, _showUi, value) => {
      const editor = document.querySelector('[contenteditable="true"]');
      if (!editor) return false;
      if (command === 'insertHTML') {
        editor.innerHTML += value || '';
      }
      if (command === 'formatBlock') {
        editor.innerHTML = `<${value}>${editor.textContent || 'Heading'}</${value}>`;
      }
      return true;
    });
  });

  afterEach(() => {
    document.execCommand = originalExecCommand;
    cleanup();
    vi.restoreAllMocks();
  });

  it('persists edits, previews sanitized content, and supports undo redo', () => {
    const handleChange = vi.fn();
    const { container } = render(<RichTextEditor value="<p>Initial</p>" onChange={handleChange} />);
    const editor = container.querySelector('[contenteditable="true"]');

    editor.innerHTML = '<p>First edit</p>';
    fireEvent.input(editor);
    editor.innerHTML = '<p>Second edit</p>';
    fireEvent.input(editor);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(editor.innerHTML).toBe('<p>First edit</p>');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(editor.innerHTML).toBe('<p>Second edit</p>');

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByLabelText('Preview').textContent).toContain('Second edit');
    expect(handleChange).toHaveBeenCalledWith('<p>Second edit</p>');
  });

  it('wires formatting commands and cleans pasted HTML', () => {
    const { container } = render(<RichTextEditor value="<p>Initial</p>" onChange={vi.fn()} />);
    const editor = container.querySelector('[contenteditable="true"]');

    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bullet list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Numbered list' }));

    expect(document.execCommand).toHaveBeenCalledWith('bold', false, null);
    expect(document.execCommand).toHaveBeenCalledWith('italic', false, null);
    expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, null);
    expect(document.execCommand).toHaveBeenCalledWith('insertOrderedList', false, null);

    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type) => (type === 'text/html' ? '<p style="color:red">Safe <img src="/bad.jpg"><script>bad()</script></p>' : 'Safe'),
      },
    });

    expect(document.execCommand).toHaveBeenCalledWith('insertHTML', false, '<p>Safe </p>');
  });

  it('creates safe links and clears formatting', () => {
    const { container } = render(<RichTextEditor value="<p>Initial</p>" onChange={vi.fn()} />);
    const editor = container.querySelector('[contenteditable="true"]');
    vi.spyOn(window, 'prompt').mockReturnValue('example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(document.execCommand).toHaveBeenCalledWith('createLink', false, 'https://example.com/');

    editor.innerHTML = '<p><strong>Plain</strong> text</p>';
    fireEvent.click(screen.getByRole('button', { name: 'Clear formatting' }));
    expect(editor.innerHTML).toBe('<p>Plain text</p>');
  });
});
