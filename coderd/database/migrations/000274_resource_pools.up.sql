CREATE TABLE IF NOT EXISTS resource_pools
(
    id               uuid                     NOT NULL,
    name             text                     NOT NULL,
    capacity         integer                  NOT NULL,
    template_file_id uuid                     NOT NULL REFERENCES files (id) ON DELETE CASCADE,
    user_id          uuid                     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    organization_id  uuid                     NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    created_at       timestamp with time zone NOT NULL,
    updated_at       timestamp with time zone NOT NULL,

    PRIMARY KEY (id),
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS resource_pool_entries
(
    id         uuid                     NOT NULL,
    reference  text                     NOT NULL, -- TODO: maybe this can be NULLable while a job executes?
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
--     job_id       uuid NOT NULL REFERENCES provisioner_jobs (id) ON DELETE CASCADE,

    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS resource_pool_claims
(
    id                     uuid NOT NULL,
    resource_pool_entry_id uuid NOT NULL REFERENCES resource_pool_entries (id) ON DELETE CASCADE,
    user_id                uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id           uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
--     job_id       uuid NOT NULL REFERENCES provisioner_jobs (id) ON DELETE CASCADE,

    PRIMARY KEY (id)
);

ALTER TYPE provisioner_job_type ADD VALUE 'resource_pool_entry_build';