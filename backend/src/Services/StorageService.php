<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Support\Config;
use Jamarq\CpanelBackend\Storage\LocalStorageAdapter;
use Jamarq\CpanelBackend\Storage\R2StorageAdapter;
use Jamarq\CpanelBackend\Storage\StorageAdapterInterface;
use Jamarq\CpanelBackend\Storage\StoredObject;

final class StorageService
{
    public function provider(): string
    {
        $provider = strtolower(trim((string) Config::get('media.storage_provider', 'local')));
        return $provider === 'r2' && $this->r2Configured() ? 'r2' : 'local';
    }

    public function r2Configured(): bool
    {
        return $this->r2Endpoint() !== ''
            && $this->r2AccessKeyId() !== ''
            && $this->r2SecretAccessKey() !== ''
            && ($this->r2PublicBucket() !== '' || $this->r2PrivateBucket() !== '');
    }

    public function publicBucket(): ?string
    {
        $bucket = $this->r2PublicBucket();
        return $bucket !== '' ? $bucket : null;
    }

    public function privateBucket(): ?string
    {
        $bucket = $this->r2PrivateBucket();
        return $bucket !== '' ? $bucket : null;
    }

    public function publicBaseUrl(): ?string
    {
        $baseUrl = trim((string) Config::get('media.r2_public_base_url', ''));
        return $baseUrl !== '' ? rtrim($baseUrl, '/') : null;
    }

    /** @param array<string, mixed> $metadata */
    public function putPublic(string $key, string $sourcePath, array $metadata = []): StoredObject
    {
        return $this->publicAdapter()->putFile($key, $sourcePath, $metadata);
    }

    /** @param array<string, mixed> $metadata */
    public function putPrivate(string $key, string $sourcePath, array $metadata = []): StoredObject
    {
        return $this->privateAdapter()->putFile($key, $sourcePath, $metadata);
    }

    public function publicUrl(string $key): ?string
    {
        return $this->publicAdapter()->url($key);
    }

    public function deletePublic(string $key): bool
    {
        return $this->publicAdapter()->delete($key);
    }

    public function deletePrivate(string $key): bool
    {
        return $this->privateAdapter()->delete($key);
    }

    /** @return array<string, mixed> */
    public function systemStatus(): array
    {
        return [
            'active_provider' => $this->provider(),
            'r2_configured' => $this->r2Configured(),
            'public_bucket' => $this->publicBucket(),
            'private_bucket' => $this->privateBucket(),
            'public_base_url' => $this->publicBaseUrl(),
            'local_fallback_path' => rtrim((string) Config::get('media.upload_dir'), '/'),
        ];
    }

    private function publicAdapter(): StorageAdapterInterface
    {
        if ($this->provider() === 'r2') {
            $bucket = $this->r2PublicBucket();
            if ($bucket !== '') {
                return new R2StorageAdapter(
                    $this->r2Endpoint(),
                    $this->r2AccessKeyId(),
                    $this->r2SecretAccessKey(),
                    $bucket,
                    $this->publicBaseUrl()
                );
            }
        }

        return new LocalStorageAdapter(
            rtrim((string) Config::get('media.upload_dir'), '/'),
            (string) Config::get('media.public_url_prefix', '/uploads')
        );
    }

    private function privateAdapter(): StorageAdapterInterface
    {
        if ($this->provider() === 'r2') {
            $bucket = $this->r2PrivateBucket();
            if ($bucket !== '') {
                return new R2StorageAdapter(
                    $this->r2Endpoint(),
                    $this->r2AccessKeyId(),
                    $this->r2SecretAccessKey(),
                    $bucket
                );
            }
        }

        return new LocalStorageAdapter(
            rtrim((string) Config::get('media.upload_dir'), '/'),
            (string) Config::get('media.public_url_prefix', '/uploads')
        );
    }

    private function r2Endpoint(): string
    {
        return rtrim(trim((string) Config::get('media.r2_endpoint', '')), '/');
    }

    private function r2AccessKeyId(): string
    {
        return trim((string) Config::get('media.r2_access_key_id', ''));
    }

    private function r2SecretAccessKey(): string
    {
        return trim((string) Config::get('media.r2_secret_access_key', ''));
    }

    private function r2PublicBucket(): string
    {
        return trim((string) Config::get('media.r2_public_bucket', ''));
    }

    private function r2PrivateBucket(): string
    {
        return trim((string) Config::get('media.r2_private_bucket', ''));
    }
}
