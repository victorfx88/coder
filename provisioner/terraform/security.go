package terraform

import (
	"context"
	"github.com/coder/coder/v2/coderd/tracing"
)

type TfsecViolations struct {
	Results []TfsecViolation `json:"results"`
}

type TfsecViolation struct {
	RuleId          string   `json:"rule_id"`
	LongId          string   `json:"long_id"`
	RuleDescription string   `json:"rule_description"`
	RuleProvider    string   `json:"rule_provider"`
	RuleService     string   `json:"rule_service"`
	Impact          string   `json:"impact"`
	Resolution      string   `json:"resolution"`
	Links           []string `json:"links"`
	Description     string   `json:"description"`
	Severity        string   `json:"severity"`
	Warning         bool     `json:"warning"`
	Status          int      `json:"status"`
	Resource        string   `json:"resource"`
	Location        struct {
		Filename  string `json:"filename"`
		StartLine int    `json:"start_line"`
		EndLine   int    `json:"end_line"`
	} `json:"location"`
}

func (e *executor) runSecurityScan(ctx context.Context, killCtx context.Context) (TfsecViolations, error) {
	ctx, span := e.server.startTrace(ctx, tracing.FuncName())
	defer span.End()

	args := []string{"--format", "json"}
	var violations TfsecViolations
	return violations, e.execParseTfsecJSON(ctx, killCtx, args, e.basicEnv(), &violations)
}
