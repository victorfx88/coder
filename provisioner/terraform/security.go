package terraform

import (
	"context"
	"github.com/coder/coder/v2/coderd/tracing"
	"github.com/coder/coder/v2/provisionersdk/proto"
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

func (e *executor) runSecurityScan(ctx context.Context, killCtx context.Context) ([]*proto.SecurityViolation, error) {
	ctx, span := e.server.startTrace(ctx, tracing.FuncName())
	defer span.End()

	args := []string{"--format", "json"}
	var violations TfsecViolations
	if err := e.execParseTfsecJSON(ctx, killCtx, args, e.basicEnv(), &violations); err != nil {
		return nil, err
	}

	if len(violations.Results) == 0 {
		return nil, nil
	}

	var secVios []*proto.SecurityViolation
	for _, vio := range violations.Results {
		secVios = append(secVios, &proto.SecurityViolation{
			RuleId:          vio.RuleId,
			LongId:          vio.LongId,
			RuleDescription: vio.RuleDescription,
			RuleProvider:    vio.RuleProvider,
			RuleService:     vio.RuleService,
			Impact:          vio.Impact,
			Resolution:      vio.Resolution,
			Links:           vio.Links,
			Description:     vio.Description,
			Severity:        vio.Severity,
			Warning:         vio.Warning,
			Status:          int32(vio.Status),
			Resource:        vio.Resource,
			Location: &proto.SecurityViolation_Location{
				Filename:  vio.Location.Filename,
				StartLine: int32(vio.Location.StartLine),
				EndLine:   int32(vio.Location.EndLine),
			},
		})
	}

	return secVios, nil
}
