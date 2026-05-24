import { describe, expect, it } from 'vitest';
import { cleanPastedRichText, normalizeRichTextUrl, richTextToPlainText, sanitizeRichText } from './richText';

describe('rich text utilities', () => {
  it('keeps approved formatting and strips unsafe markup', () => {
    const result = sanitizeRichText(`
      <p style="color:red"><strong>Bold</strong> <em>Italic</em></p>
      <h3 class="large">Heading</h3>
      <script>bad()</script>
      <span>Span text</span>
      <img src="/x.jpg">
      <a href="javascript:bad()">bad</a>
      <a href="https://example.com" style="color:red">good</a>
      <div class="rt-cols-3" style="display:block"><p>Column</p></div>
    `);

    expect(result).toContain('<strong>Bold</strong>');
    expect(result).toContain('<em>Italic</em>');
    expect(result).toContain('<h3>Heading</h3>');
    expect(result).toContain('Span text');
    expect(result).not.toContain('script');
    expect(result).not.toContain('img');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('style=');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('<div class="rt-cols-3">');
  });

  it('normalizes allowed links and rejects unsafe protocols', () => {
    expect(normalizeRichTextUrl('example.com/page')).toBe('https://example.com/page');
    expect(normalizeRichTextUrl('/services')).toBe('/services');
    expect(normalizeRichTextUrl('#faq')).toBe('#faq');
    expect(normalizeRichTextUrl('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(normalizeRichTextUrl('tel:3365550100')).toBe('tel:3365550100');
    expect(normalizeRichTextUrl('javascript:bad()')).toBe('');
  });

  it('converts pasted plain text and produces plain excerpts', () => {
    expect(cleanPastedRichText({ text: 'First\n\nSecond' })).toBe('<p>First</p><p>Second</p>');
    expect(richTextToPlainText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });
});
