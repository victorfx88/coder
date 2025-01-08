-- name: InsertTfsecViolation :one
INSERT INTO tfsec_violations (
	id, job_id, rule_id, long_id, rule_description, rule_provider, rule_service, impact, resolution, links, description, severity, warning, status, resource, filename, start_line, end_line
) VALUES (
			 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
		 )
RETURNING *;

-- name: GetTfsecViolation :one
SELECT * FROM tfsec_violations
WHERE id = $1 AND job_id = $2;

-- name: GetTfsecViolations :many
SELECT * FROM tfsec_violations
WHERE job_id = $1
ORDER BY id;


-- name: DeleteTfsecViolation :exec
DELETE FROM tfsec_violations
WHERE id = $1;
