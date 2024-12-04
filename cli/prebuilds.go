package cli

import (
	"context"
	"encoding/json"
	"os"
	"regexp"
	"slices"
	"strings"

	"cdr.dev/slog"
	"cdr.dev/slog/sloggers/sloghuman"
	"github.com/awalterschulze/gographviz"
	"github.com/coder/serpent"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/cli/cliui"
	"github.com/coder/coder/v2/codersdk"
)

func (r *RootCmd) prebuilds() *serpent.Command {
	var (
		appearanceConfig codersdk.AppearanceConfig
	)

	client := new(codersdk.Client)
	cmd := &serpent.Command{
		Annotations: workspaceCommand,
		Use:         "prebuilds <template>",
		Short:       "Prepare a template for prebuilds",
		Middleware: serpent.Chain(
			serpent.RequireNArgs(1),
			r.InitClient(client),
			initAppearance(client, &appearanceConfig),
		),
		Handler: func(inv *serpent.Invocation) error {
			ctx, cancel := context.WithCancel(inv.Context())
			defer cancel()

			// notifyCtx, notifyCancel := inv.SignalNotifyContext(ctx, StopSignals...)
			// defer notifyCancel()

			f, err := os.ReadFile(inv.Args[0])
			if err != nil {
				panic(err)
			}
			analyze(ctx, inv, f)

			return nil
		},
	}

	return cmd
}

func analyze(ctx context.Context, inv *serpent.Invocation, in []byte) {
	logger := inv.Logger.AppendSinks(sloghuman.Sink(inv.Stderr)).Leveled(slog.LevelInfo)

	// Parse the DOT data
	graphAst, err := gographviz.ParseString(string(in))
	if err != nil {
		panic(err)
	}

	graph := gographviz.NewGraph()
	if err := gographviz.Analyse(graphAst, graph); err != nil {
		panic(err)
	}

	adjacencies := make(map[string][]*gographviz.Node)

	var nodes []string
	for name := range graph.Edges.SrcToDsts {
		nodes = append(nodes, name)
	}
	slices.Sort(nodes)

	// Find resources which are eligible to be prebuilt
	var eligible []string
	for _, name := range nodes {
		resource, err := parseName(name)
		if err != nil {
			logger.Warn(ctx, "failed to parse node name", slog.F("name", name), slog.Error(err))
			continue
		}

		switch {
		// Datasources cannot be prebuilt
		case resource.Provider == "data",
			strings.Index(resource.Provider, "coder_") == 0:
			continue
		default:
			eligible = append(eligible, resource.String())
		}
	}

	// Iterate over all nodes to build up adjacency list
	for _, node := range nodes {
		edges, ok := graph.Edges.SrcToDsts[node]
		if !ok {
			continue
		}

		resource, err := parseName(node)
		if err != nil {
			continue
		}

		visited := make(map[string]struct{})
		deps := make([]*gographviz.Node, 0)

		for en := range edges {
			deps = visit(visited, graph, graph.Nodes.Lookup[en], deps)
		}

		slices.SortFunc(deps, sortNodes)
		adjacencies[resource.String()] = deps
	}

	selected, err := cliui.MultiSelect(inv, cliui.MultiSelectOptions{
		Message:  "Choose which resources you would like to prebuild",
		Options:  eligible,
		Defaults: []string{"aws_instance.workspace"},
	})
	if err != nil {
		logger.Error(ctx, "Error choosing resources to evaluate for prebuildability", slog.Error(err))
		return
	}

	// O=1 lookup
	eligibleMap := make(map[string]struct{}, len(selected))
	for _, node := range selected {
		eligibleMap[node] = struct{}{}
	}

	// Determine eligibility of all resources
	for name, deps := range adjacencies {
		if _, ok := eligibleMap[name]; !ok {
			logger.Debug(ctx, "skipping, not eligible", slog.F("resource", name))
			continue
		}

		var ineligibleDeps []*resourceDesc
		for _, dep := range deps {
			resource, err := parseName(dep.Name)
			if err != nil {
				logger.Error(ctx, "failed to parse node name", slog.F("name", dep.Name), slog.Error(err))
				continue
			}

			switch {
			case (strings.Index(resource.Provider, "coder_") == 0 || strings.Index(resource.Resource, "coder_") == 0) &&
				resource.Resource != "coder_provisioner": // Exception, this is fine to use.
				ineligibleDeps = append(ineligibleDeps, resource)
			}
		}
		prebuildable := len(ineligibleDeps) == 0

		logger.Info(ctx, "outcome", slog.F("resource", name),
			slog.F("dep_count", len(deps)),
			slog.F("prebuildable", prebuildable))
		if !prebuildable {
			logger.Info(ctx, "ineligible due to these dependencies", slog.F("count", len(ineligibleDeps)))
			for _, res := range ineligibleDeps {
				logger.Info(ctx, "\t", slog.F("dependency", res.String()))
			}
		}
	}
}

// visit performs a depth-first search to find all connected nodes
func visit(visited map[string]struct{}, graph *gographviz.Graph, node *gographviz.Node, list []*gographviz.Node) []*gographviz.Node {
	if _, ok := visited[node.Name]; ok {
		return list
	}

	visited[node.Name] = struct{}{}
	list = append(list, node)

	neighbours, ok := graph.Edges.SrcToDsts[node.Name]
	if !ok {
		return list
	}

	for name := range neighbours {
		if !isValid(name) {
			continue
		}

		list = visit(visited, graph, graph.Nodes.Lookup[name], list)
	}

	return list
}

func sortNodes(a *gographviz.Node, b *gographviz.Node) int {
	if a == nil || b == nil {
		return 0
	}
	return strings.Compare(a.Name, b.Name)
}

func isValid(name string) bool {
	var isProvider = regexp.MustCompile(`\bprovider\b`)
	if isProvider.MatchString(name) {
		return false
	}

	return true
}

type resourceDesc struct {
	Graph     string `json:"graph,omitempty"`
	Provider  string `json:"prov,omitempty"`
	Resource  string `json:"res,omitempty"`
	Attribute string `json:"attr,omitempty"`
}

func parseName(name string) (*resourceDesc, error) {
	var parser = regexp.MustCompile(`"?(?P<graph>^[^\]]+]\s+)?(?P<prov>\w+)\.(?P<res>\w+)(?:\.(?P<attr>\w+))?"?.+`)
	names := parser.SubexpNames()

	matches := parser.FindStringSubmatch(name)
	res := make(map[string]string)

	if len(matches) != len(names) {
		return nil, xerrors.Errorf("%q: no matches", name)
	}

	for i := range names {
		// Group 0 always captures full match.
		if i == 0 {
			continue
		}
		res[names[i]] = matches[i]
	}

	out, err := json.Marshal(res)
	if err != nil {
		return nil, err
	}

	var blah resourceDesc
	if err := json.Unmarshal(out, &blah); err != nil {
		return nil, err
	}

	return &blah, nil
}

func (r resourceDesc) String() string {
	var segs []string
	if r.Provider != "" {
		segs = append(segs, r.Provider)
	}
	if r.Resource != "" {
		segs = append(segs, r.Resource)
	}
	if r.Attribute != "" {
		segs = append(segs, r.Attribute)
	}

	return strings.Join(segs, ".")
}
