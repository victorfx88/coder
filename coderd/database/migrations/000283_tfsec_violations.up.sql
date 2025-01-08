CREATE TABLE tfsec_violations
(
	id               uuid PRIMARY KEY,
	job_id           uuid NOT NULL REFERENCES provisioner_jobs (id) ON DELETE CASCADE,
	rule_id          text NOT NULL,
	long_id          text NOT NULL,
	rule_description text,
	rule_provider    text,
	rule_service     text,
	impact           text,
	resolution       text,
	links            text[],
	description      text,
	severity         text,
	warning          boolean,
	status           integer,
	resource         text,
	filename         text,
	start_line       integer,
	end_line         integer,
	created_at       timestamptz DEFAULT CURRENT_TIMESTAMP,
	updated_at       timestamptz DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tfsec_violations
	ADD UNIQUE (job_id, rule_id);
