<?php

declare(strict_types=1);

namespace BowWowSpa\Services;

use BowWowSpa\Database\Database;

final class AuditService
{
    public function log(int $adminId, string $action, string $entityType, ?int $entityId, array $metadata = []): void
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $agent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        Database::run(
            'INSERT INTO audit_log (admin_user_id, action, entity_type, entity_id, metadata_json, ip, user_agent, created_at) 
             VALUES (:uid, :action, :etype, :eid, :meta, :ip, :agent, NOW())',
            [
                'uid' => $adminId,
                'action' => $action,
                'etype' => $entityType,
                'eid' => $entityId,
                'meta' => json_encode($metadata),
                'ip' => $ip,
                'agent' => $agent,
            ]
        );
    }

    public function recent(int $limit = 20): array
    {
        $limit = max(1, $limit);
        $sql = 'SELECT audit_log.*, admin_users.email 
                FROM audit_log 
                LEFT JOIN admin_users ON admin_users.id = audit_log.admin_user_id
                ORDER BY audit_log.created_at DESC 
                LIMIT ' . (int) $limit;

        return Database::fetchAll($sql);
    }
}
