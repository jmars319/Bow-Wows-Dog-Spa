<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;
use BowWowSpa\Support\Config;
use BowWowSpa\Support\Input;

final class BookingAttachmentService
{
    private const ALLOWED_MIME = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
    ];

    public function listForBooking(int $bookingId): array
    {
        $rows = Database::fetchAll(
            'SELECT * FROM booking_request_attachments WHERE booking_request_id = :booking_id ORDER BY created_at ASC, id ASC',
            ['booking_id' => $bookingId]
        );

        return array_map([$this, 'hydrateRow'], $rows);
    }

    public function storeForBooking(int $bookingId, array $fileInput): array
    {
        $stored = [];
        foreach ($this->normalizeFiles($fileInput) as $file) {
            try {
                $this->validateUpload($file);

                $mime = $this->detectMime($file['tmp_name']);
                $extension = self::ALLOWED_MIME[$mime] ?? null;
                if ($extension === null) {
                    throw new \RuntimeException('Unsupported paperwork file type.');
                }

                $directory = $this->baseDirectory() . '/' . date('Y/m');
                if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                    throw new \RuntimeException('Unable to create booking paperwork directory.');
                }

                $storedName = sprintf(
                    'booking-%d-%s.%s',
                    $bookingId,
                    bin2hex(random_bytes(8)),
                    $extension
                );
                $absolutePath = $directory . '/' . $storedName;

                if (!move_uploaded_file($file['tmp_name'], $absolutePath)) {
                    throw new \RuntimeException('Unable to store uploaded paperwork.');
                }

                $relativePath = ltrim(str_replace($this->baseDirectory(), '', $absolutePath), '/');
                $originalName = $this->sanitizeOriginalName((string) ($file['name'] ?? ''), $extension);

                $id = Database::insert(
                    'INSERT INTO booking_request_attachments (booking_request_id, original_name, stored_name, file_path, mime_type, file_size_bytes, created_at)
                     VALUES (:booking_request_id, :original_name, :stored_name, :file_path, :mime_type, :file_size_bytes, NOW())',
                    [
                        'booking_request_id' => $bookingId,
                        'original_name' => $originalName,
                        'stored_name' => $storedName,
                        'file_path' => $relativePath,
                        'mime_type' => $mime,
                        'file_size_bytes' => (int) ($file['size'] ?? 0),
                    ]
                );

                $stored[] = $this->find($bookingId, $id);
            } catch (\Throwable $e) {
                error_log('[BowWow][booking_upload_failed] ' . $e->getMessage());
                throw $e;
            }
        }

        return array_values(array_filter($stored));
    }

    public function find(int $bookingId, int $attachmentId): ?array
    {
        $row = Database::fetch(
            'SELECT * FROM booking_request_attachments WHERE booking_request_id = :booking_id AND id = :id LIMIT 1',
            ['booking_id' => $bookingId, 'id' => $attachmentId]
        );

        return $row ? $this->hydrateRow($row) : null;
    }

    public function absolutePath(array $attachment): string
    {
        return $this->baseDirectory() . '/' . ltrim((string) $attachment['file_path'], '/');
    }

    private function hydrateRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'booking_request_id' => (int) $row['booking_request_id'],
            'original_name' => (string) $row['original_name'],
            'stored_name' => (string) $row['stored_name'],
            'file_path' => (string) $row['file_path'],
            'mime_type' => (string) $row['mime_type'],
            'file_size_bytes' => (int) $row['file_size_bytes'],
            'created_at' => $row['created_at'] ?? null,
        ];
    }

    private function normalizeFiles(array $fileInput): array
    {
        if (($fileInput['name'] ?? null) === null) {
            return [];
        }

        if (!is_array($fileInput['name'])) {
            return [$fileInput];
        }

        $files = [];
        foreach ($fileInput['name'] as $index => $name) {
            $files[] = [
                'name' => $name,
                'type' => $fileInput['type'][$index] ?? null,
                'tmp_name' => $fileInput['tmp_name'][$index] ?? null,
                'error' => $fileInput['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                'size' => $fileInput['size'][$index] ?? 0,
            ];
        }

        return $files;
    }

    private function validateUpload(array $file): void
    {
        if (($file['error'] ?? UPLOAD_ERR_OK) === UPLOAD_ERR_NO_FILE) {
            throw new \RuntimeException('No paperwork file uploaded.');
        }

        $error = (int) ($file['error'] ?? UPLOAD_ERR_OK);
        if ($error !== UPLOAD_ERR_OK) {
            $message = match ($error) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Paperwork file is too large. Please upload a smaller PDF, JPG, or PNG.',
                UPLOAD_ERR_PARTIAL => 'Paperwork upload was interrupted. Please try again.',
                default => 'Paperwork upload failed. Please try again.',
            };
            throw new \RuntimeException($message);
        }

        if (($file['size'] ?? 0) <= 0) {
            throw new \RuntimeException('Uploaded paperwork is empty.');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new \RuntimeException('Paperwork upload could not be verified.');
        }

        $maxBytes = (int) Config::get('media.max_bytes', 8 * 1024 * 1024);
        if (($file['size'] ?? 0) > $maxBytes) {
            throw new \RuntimeException('Paperwork file is too large. Please keep uploads under ' . $this->formatBytes($maxBytes) . '.');
        }

        if ($this->hasSuspiciousDoubleExtension((string) ($file['name'] ?? ''))) {
            throw new \RuntimeException('Paperwork filename is not allowed. Please upload a PDF, JPG, or PNG.');
        }
    }

    private function detectMime(string $path): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $path) ?: 'application/octet-stream';
        finfo_close($finfo);

        return $mime;
    }

    private function baseDirectory(): string
    {
        $uploadDir = rtrim((string) Config::get('media.upload_dir'), '/');
        return $uploadDir . '/booking-paperwork';
    }

    private function formatBytes(int $bytes): string
    {
        $mb = $bytes / (1024 * 1024);
        return rtrim(rtrim(number_format($mb, 1), '0'), '.') . ' MB';
    }

    private function sanitizeOriginalName(string $name, string $extension): string
    {
        $clean = Input::clean(basename($name), 180);
        return $clean ?? ('paperwork.' . $extension);
    }

    private function hasSuspiciousDoubleExtension(string $name): bool
    {
        $parts = array_values(array_filter(explode('.', strtolower(basename($name)))));
        if (count($parts) < 3) {
            return false;
        }

        array_pop($parts);
        $dangerous = ['php', 'phtml', 'phar', 'exe', 'com', 'js', 'sh', 'cgi', 'pl', 'py', 'rb', 'jar', 'bat'];
        foreach ($parts as $part) {
            if (in_array($part, $dangerous, true)) {
                return true;
            }
        }

        return false;
    }
}
