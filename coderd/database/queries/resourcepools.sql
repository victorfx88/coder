-- name: InsertResourcePool :one
INSERT INTO resource_pools (id, name, capacity, template_file_id, user_id, organization_id, created_at, updated_at)
VALUES (@id::uuid, @name::text, @capacity::integer, @template_file_id::uuid,
        @user_id::uuid, @organization_id::uuid, NOW(), NOW())
RETURNING *;