<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Support\Config;

final class MediaUploadValidator
{
    private const ALLOWED_MIME = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/csv',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
    ];

    private const BLOCKED_EXTENSIONS = [
        'app', 'bat', 'bin', 'cmd', 'com', 'dll', 'dmg', 'exe', 'html', 'htm',
        'iso', 'jar', 'js', 'mjs', 'php', 'phar', 'phtml', 'sh', 'svg', 'swf',
        'tar', 'gz', 'tgz', 'rar', '7z', 'zip',
    ];

    private const EXTENSION_MIME_MAP = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'gif' => ['image/gif'],
        'webp' => ['image/webp'],
        'pdf' => ['application/pdf'],
        'txt' => ['text/plain'],
        'csv' => ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
        'doc' => ['application/msword'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'xls' => ['application/vnd.ms-excel'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
    ];

    public function validateUpload(array $file, array $config): void
    {
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new \RuntimeException($this->uploadErrorMessage((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE), $config));
        }

        if (($file['size'] ?? 0) <= 0) {
            throw new \RuntimeException('Empty upload.');
        }

        if ($file['size'] > $config['max_bytes']) {
            throw new \RuntimeException('File exceeds allowed size.');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !$this->isUploadedFile($tmpName)) {
            throw new \RuntimeException('Uploaded file could not be verified.');
        }

        $mime = $this->detectMime($tmpName);
        if (!in_array($mime, self::ALLOWED_MIME, true)) {
            throw new \RuntimeException('Unsupported file type.');
        }
    }

    public function isUploadedFile(string $path): bool
    {
        if (is_uploaded_file($path)) {
            return true;
        }

        return Config::get('app.env') === 'testing' && is_file($path);
    }

    public function detectMime(string $path): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $path) ?: 'application/octet-stream';
        if (PHP_VERSION_ID < 80500) {
            finfo_close($finfo);
        }
        return $mime;
    }

    public function validateExtensionAndMime(string $path, string $originalName, string $mime): void
    {
        $extension = $this->extensionForOriginalName($originalName);
        if ($extension === '') {
            throw new \RuntimeException('Uploaded file needs a valid extension.');
        }
        if (in_array($extension, self::BLOCKED_EXTENSIONS, true)) {
            throw new \RuntimeException('File type not allowed.');
        }
        if (!isset(self::EXTENSION_MIME_MAP[$extension])) {
            throw new \RuntimeException('File type not allowed.');
        }
        if (!in_array($mime, self::EXTENSION_MIME_MAP[$extension], true)) {
            throw new \RuntimeException('File extension does not match the file type.');
        }
        if ($mime === 'application/zip' && in_array($extension, ['docx', 'xlsx'], true) && !$this->isOfficeOpenXml($path, $extension)) {
            throw new \RuntimeException('Office document could not be verified.');
        }
    }

    public function normalizeDetectedMime(string $mime, string $originalName): string
    {
        $extension = $this->extensionForOriginalName($originalName);
        if ($mime === 'application/zip') {
            if ($extension === 'docx') {
                return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            }
            if ($extension === 'xlsx') {
                return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            }
        }
        return $mime;
    }

    public function extensionFromMime(string $mime, string $originalName = ''): string
    {
        return match ($mime) {
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'application/pdf' => 'pdf',
            'text/csv', 'application/csv' => 'csv',
            'text/plain' => strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) === 'csv' ? 'csv' : 'txt',
            'application/msword' => 'doc',
            'application/vnd.ms-excel' => strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) === 'csv' ? 'csv' : 'xls',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            default => 'jpg',
        };
    }

    public function assetTypeForMime(string $mime, string $name = ''): string
    {
        if (str_starts_with($mime, 'image/')) {
            return 'image';
        }
        $extension = $this->extensionForOriginalName($name);
        if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
            return 'image';
        }
        if (in_array($extension, ['csv', 'xls', 'xlsx'], true)) {
            return 'spreadsheet';
        }
        if ($extension === 'txt') {
            return 'text';
        }
        return 'document';
    }

    private function extensionForOriginalName(string $originalName): string
    {
        return strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    }

    private function isOfficeOpenXml(string $path, string $extension): bool
    {
        if (!class_exists(\ZipArchive::class)) {
            return true;
        }
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return false;
        }
        $hasContentTypes = $zip->locateName('[Content_Types].xml') !== false;
        $hasOfficeRoot = $extension === 'docx'
            ? $zip->locateName('word/document.xml') !== false
            : $zip->locateName('xl/workbook.xml') !== false;
        $zip->close();
        return $hasContentTypes && $hasOfficeRoot;
    }

    private function uploadErrorMessage(int $code, array $config): string
    {
        $appLimit = $this->formatBytes((int) ($config['max_bytes'] ?? 0));
        $phpLimit = ini_get('upload_max_filesize') ?: null;

        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'That file is larger than the server upload limit'
                . ($phpLimit ? " ({$phpLimit})" : '')
                . ($appLimit ? " or the app limit ({$appLimit})." : '.'),
            UPLOAD_ERR_PARTIAL => 'The upload did not finish. Please try the file again.',
            UPLOAD_ERR_NO_FILE => 'Choose a file before uploading.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE, UPLOAD_ERR_EXTENSION => 'The server could not receive the uploaded file. Please try again or contact support.',
            default => 'The upload could not be received. Please try again.',
        };
    }

    private function formatBytes(int $bytes): ?string
    {
        if ($bytes <= 0) {
            return null;
        }

        $mb = $bytes / 1024 / 1024;
        return rtrim(rtrim(number_format($mb, 1), '0'), '.') . ' MB';
    }
}
