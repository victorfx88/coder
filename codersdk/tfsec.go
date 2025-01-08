package codersdk

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"net/http"
)

type TfsecViolation struct {
	RuleID          string   `db:"rule_id" json:"rule_id"`
	LongID          string   `db:"long_id" json:"long_id"`
	RuleDescription string   `db:"rule_description" json:"rule_description"`
	RuleProvider    string   `db:"rule_provider" json:"rule_provider"`
	RuleService     string   `db:"rule_service" json:"rule_service"`
	Impact          string   `db:"impact" json:"impact"`
	Resolution      string   `db:"resolution" json:"resolution"`
	Links           []string `db:"links" json:"links"`
	Description     string   `db:"description" json:"description"`
	Severity        string   `db:"severity" json:"severity"`
	Warning         bool     `db:"warning" json:"warning"`
	Status          int      `db:"status" json:"status"`
	Resource        string   `db:"resource" json:"resource"`
	Filename        string   `db:"filename" json:"filename"`
	StartLine       int      `db:"start_line" json:"start_line"`
	EndLine         int      `db:"end_line" json:"end_line"`
}

func (c *Client) TfsecViolations(ctx context.Context, jobID uuid.UUID) ([]TfsecViolation, error) {
	res, err := c.Request(ctx, http.MethodGet, fmt.Sprintf("/api/v2/tfsec-violations/%s", jobID), nil)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, ReadBodyAsError(res)
	}
	var violations []TfsecViolation
	d := json.NewDecoder(res.Body)
	d.UseNumber()
	return violations, d.Decode(&violations)
}
