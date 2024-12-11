DROP TABLE IF EXISTS template_version_resource_pool_claims;
DROP TABLE IF EXISTS resource_pool_entries;
DROP TABLE IF EXISTS resource_pools;

-- Note: We don't can't remove the enum value from provisioner_job_type
-- as there's no direct way to remove enum values in PostgreSQL.