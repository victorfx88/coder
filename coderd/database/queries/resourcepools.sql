-- name: InsertResourcePool :one
INSERT INTO resource_pools (id, name, capacity, template_file_id, user_id, organization_id, created_at, updated_at)
VALUES (@id::uuid, @name::text, @capacity::integer, @template_file_id::uuid,
        @user_id::uuid, @organization_id::uuid, NOW(), NOW())
RETURNING *;

-- name: InsertResourcePoolEntry :one
INSERT INTO resource_pool_entries (id, reference, resource_pool_id, job_id, created_at, updated_at)
VALUES (@id::uuid, @object_id::text, @pool_id::uuid, @job_id::uuid, NOW(), NOW())
RETURNING *;