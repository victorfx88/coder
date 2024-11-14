-- name: InsertResourcePool :one
INSERT INTO resource_pools (id, name, capacity, template_file_id, user_id, organization_id, created_at, updated_at)
VALUES (@id::uuid, @name::text, @capacity::integer, @template_file_id::uuid,
        @user_id::uuid, @organization_id::uuid, NOW(), NOW())
RETURNING *;

-- name: InsertResourcePoolEntry :one
INSERT INTO resource_pool_entries (id, reference, resource_pool_id, job_id, created_at, updated_at)
VALUES (@id::uuid, @object_id::text, @pool_id::uuid, @job_id::uuid, NOW(), NOW())
RETURNING *;

-- name: GetClaimableResourcePoolEntries :many
SELECT * FROM resource_pool_entries WHERE resource_pool_id = @pool_id::uuid AND claimant_id IS NULL;

-- name: ClaimResourcePoolEntry :one
UPDATE resource_pool_entries
SET claimant_id = @claimant_id::uuid,
    updated_at  = NOW(),
    claimed_at = NOW()
WHERE id = @id::uuid
RETURNING *;

-- name: GetResourcePoolByName :one
SELECT *
FROM resource_pools
WHERE name = @name::text;