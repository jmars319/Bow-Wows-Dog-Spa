const ALLOWED_TAGS = ['p', 'strong', 'em', 'br', 'ul', 'ol', 'li', 'a', 'h3', 'div'];
const ALLOWED_DIV_CLASSES = ['rt-cols-2', 'rt-cols-3'];
const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function plainTextToRichText(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => `<p>${block.split(/\r\n|\r|\n/).map((line) => escapeHtml(line)).join('<br>') || '<br>'}</p>`)
    .join('');
}

export function hasHtmlMarkup(value = '') {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

export function normalizeRichText(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return hasHtmlMarkup(raw) ? sanitizeRichText(raw) : plainTextToRichText(raw);
}

export function richTextToPlainText(html = '') {
  const element = document.createElement('div');
  element.innerHTML = sanitizeRichText(html);
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

function hasUnsafeControlCharacter(value = '') {
  return Array.from(String(value)).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function normalizeRichTextUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw || hasUnsafeControlCharacter(raw)) return '';
  const lower = raw.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) return '';
  if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('?')) return raw;
  const normalized = /^[\w-]+(\.[\w-]+)+([/:?#].*)?$/i.test(raw) ? `https://${raw}` : raw;
  try {
    const url = new URL(normalized);
    return ALLOWED_LINK_PROTOCOLS.includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export function isExternalLink(href = '') {
  return /^https?:\/\//i.test(String(href || ''));
}

function applySafeAnchorAttributes(element, href) {
  while (element.attributes.length > 0) {
    element.removeAttribute(element.attributes[0].name);
  }
  element.setAttribute('href', href);
  if (isExternalLink(href)) {
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');
  }
}

export function cleanPastedRichText({ html = '', text = '' } = {}) {
  return html ? sanitizeRichText(html) : plainTextToRichText(text);
}

export function sanitizeRichText(html = '') {
  if (typeof html !== 'string') return '';
  const trimmed = html.trim();
  if (!trimmed) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${trimmed}</div>`, 'text/html');
  const container = doc.body.firstChild;
  if (!container) return '';

  const cleanNode = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') {
          node.removeChild(child);
          return;
        }
        cleanNode(child);
        if (!ALLOWED_TAGS.includes(tag)) {
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        if (tag === 'div') {
          const className = (child.getAttribute('class') || '').trim();
          if (!ALLOWED_DIV_CLASSES.includes(className)) {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
            return;
          }
          Array.from(child.attributes).forEach((attr) => {
            if (attr.name !== 'class') child.removeAttribute(attr.name);
          });
        } else if (tag === 'a') {
          const href = normalizeRichTextUrl(child.getAttribute('href') || '');
          if (!href) {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
            return;
          }
          applySafeAnchorAttributes(child, href);
        } else {
          while (child.attributes.length > 0) {
            child.removeAttribute(child.attributes[0].name);
          }
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    });
  };

  cleanNode(container);
  return container.innerHTML.trim();
}
