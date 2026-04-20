<?php

declare(strict_types=1);

namespace BowWowSpa\Support;

use DOMComment;
use DOMDocument;
use DOMElement;
use DOMNode;

final class HtmlSanitizer
{
    private const ALLOWED_TAGS = [
        'a',
        'blockquote',
        'br',
        'em',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'li',
        'ol',
        'p',
        'strong',
        'u',
        's',
        'ul',
    ];

    private const DROP_WITH_CONTENT = [
        'button',
        'embed',
        'form',
        'iframe',
        'input',
        'link',
        'meta',
        'object',
        'script',
        'select',
        'style',
        'svg',
        'textarea',
    ];

    public static function richText(mixed $value, int $maxLength = 12000): ?string
    {
        $html = Input::clean($value, $maxLength, true);
        if ($html === null) {
            return null;
        }

        if (!class_exists(DOMDocument::class)) {
            return self::stripTagsFallback($html);
        }

        $previousUseInternalErrors = libxml_use_internal_errors(true);
        $dom = new DOMDocument('1.0', 'UTF-8');
        $loaded = $dom->loadHTML(
            '<?xml encoding="utf-8" ?><div>' . $html . '</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );

        if (!$loaded) {
            libxml_clear_errors();
            libxml_use_internal_errors($previousUseInternalErrors);
            return self::stripTagsFallback($html);
        }

        $root = $dom->documentElement;
        if (!$root instanceof DOMElement) {
            libxml_clear_errors();
            libxml_use_internal_errors($previousUseInternalErrors);
            return self::stripTagsFallback($html);
        }

        self::sanitizeNode($root);

        $output = '';
        foreach (iterator_to_array($root->childNodes) as $child) {
            $output .= $dom->saveHTML($child);
        }

        libxml_clear_errors();
        libxml_use_internal_errors($previousUseInternalErrors);

        $output = trim($output);
        return $output !== '' ? $output : null;
    }

    private static function sanitizeNode(DOMNode $node): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMComment) {
                $node->removeChild($child);
                continue;
            }

            if (!$child instanceof DOMElement) {
                continue;
            }

            $tag = strtolower($child->tagName);
            if (in_array($tag, self::DROP_WITH_CONTENT, true)) {
                $node->removeChild($child);
                continue;
            }

            self::sanitizeNode($child);

            if (!in_array($tag, self::ALLOWED_TAGS, true)) {
                self::unwrapNode($child);
                continue;
            }

            self::sanitizeAttributes($child, $tag);
        }
    }

    private static function sanitizeAttributes(DOMElement $element, string $tag): void
    {
        $allowedAttributes = $tag === 'a' ? ['href', 'rel', 'target', 'title'] : [];

        foreach (iterator_to_array($element->attributes ?? []) as $attribute) {
            $name = strtolower($attribute->nodeName);
            if (!in_array($name, $allowedAttributes, true)) {
                $element->removeAttributeNode($attribute);
            }
        }

        if ($tag !== 'a') {
            return;
        }

        $href = trim($element->getAttribute('href'));
        if ($href === '' || !self::isAllowedHref($href)) {
            $element->removeAttribute('href');
        }

        $target = strtolower(trim($element->getAttribute('target')));
        if ($target !== '_blank') {
            $element->removeAttribute('target');
            $element->removeAttribute('rel');
            return;
        }

        $element->setAttribute('target', '_blank');
        $element->setAttribute('rel', 'noopener noreferrer');
    }

    private static function isAllowedHref(string $href): bool
    {
        if (str_starts_with($href, '#') || str_starts_with($href, '/')) {
            return true;
        }

        $scheme = parse_url($href, PHP_URL_SCHEME);
        if (!is_string($scheme) || $scheme === '') {
            return true;
        }

        return in_array(strtolower($scheme), ['http', 'https', 'mailto', 'tel'], true);
    }

    private static function unwrapNode(DOMElement $element): void
    {
        $parent = $element->parentNode;
        if ($parent === null) {
            return;
        }

        while ($element->firstChild !== null) {
            $parent->insertBefore($element->firstChild, $element);
        }

        $parent->removeChild($element);
    }

    private static function stripTagsFallback(string $html): ?string
    {
        $sanitized = strip_tags($html, '<a><blockquote><br><em><h2><h3><h4><h5><h6><li><ol><p><strong><u><s><ul>');
        $sanitized = trim($sanitized);

        return $sanitized !== '' ? $sanitized : null;
    }
}
