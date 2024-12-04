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

type adjacencyList map[string][]*gographviz.Node

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

	adjList := make(adjacencyList)

	var nodes []string
	seen := make(map[string]struct{}, len(graph.Nodes.Nodes))
	for _, node := range graph.Nodes.Nodes {
		if _, ok := seen[node.Name]; ok {
			continue
		}
		seen[node.Name] = struct{}{}

		nodes = append(nodes, node.Name)
	}
	slices.Sort(nodes)

	// Find resources which are eligible to be prebuilt.
	var eligible []string
	for _, name := range nodes {
		resource, err := parseName(name)
		if err != nil {
			logger.Warn(ctx, "failed to parse node name", slog.F("name", name), slog.Error(err))
			continue
		}

		switch {
		// Datasources cannot be prebuilt.
		case resource.Provider == "data",
			strings.Index(resource.Provider, "coder_") == 0:
			continue
		default:
			eligible = append(eligible, resource.Name())
		}
	}

	// Iterate over all nodes to build up adjacency list
	for _, node := range nodes {
		var deps []*gographviz.Node

		resource, err := parseName(node)
		if err != nil {
			continue
		}

		edges, ok := graph.Edges.SrcToDsts[node]
		if !ok {
			// No dependencies, no problem!
			adjList[resource.Name()] = deps
			continue
		}

		visited := make(map[string]struct{})

		for name := range edges {
			deps = visit(visited, graph, graph.Nodes.Lookup[name], deps)
		}

		slices.SortFunc(deps, sortNodes)
		adjList[resource.Name()] = deps
	}

	selected, err := cliui.MultiSelect(inv, cliui.MultiSelectOptions{
		Message:  "Choose which resources you would like to prebuild",
		Options:  eligible,
		Defaults: eligible, // []string{"aws_instance.workspace"},
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

	// Determine eligibility of all resources.
	for name, deps := range adjList {
		if _, ok := eligibleMap[name]; !ok {
			logger.Debug(ctx, "skipping, not eligible", slog.F("resource", name))
			continue
		}

		eligibleDeps, ineligibleDeps := buildEligibilityLists(ctx, logger, adjList, deps)
		prebuildable := len(ineligibleDeps) == 0

		logger.Info(ctx, "outcome", slog.F("resource", name),
			slog.F("dep_count", len(deps)),
			slog.F("prebuildable", prebuildable))
		logger.Info(ctx, "dependencies")
		for _, res := range eligibleDeps {
			logger.Info(ctx, "eligible", slog.F("dependency", res.Name()))
		}
		if !prebuildable {
			for _, res := range ineligibleDeps {
				logger.Info(ctx, "ineligible", slog.F("dependency", res.Name()))
			}
		}
	}
}

func buildEligibilityLists(ctx context.Context, logger slog.Logger, adjList adjacencyList, deps []*gographviz.Node) (map[string]*resourceDesc, map[string]*resourceDesc) {
	ineligibleDeps := make(map[string]*resourceDesc, len(deps))
	eligibleDeps := make(map[string]*resourceDesc, len(deps))

	for _, dep := range deps {
		node, err := parseName(dep.Name)
		if err != nil {
			logger.Error(ctx, "failed to parse node name", slog.F("name", dep.Name), slog.Error(err))
			continue
		}

		switch {
		case strings.Index(node.Provider, "coder_") == 0 || strings.Index(node.Resource, "coder_") == 0:
			ineligibleDeps[node.Name()] = node
		default:
			eligibleDeps[node.Name()] = node
		}

		// Recurse to determine if any dependencies' transitive dependencies are ineligible.
		nodes, ok := adjList[node.Name()]
		if !ok {
			// Exception: if this node matches any of the follow clauses and itself has no dependencies, then it will
			// not be included in the adjacency list. If it has no dependencies then it is safe to use.
			if node.Provider == "coder_agent" || node.Resource == "coder_provisioner" {
				if _, ok := ineligibleDeps[node.Name()]; ok {
					logger.Debug(ctx, "marking resource as safe to use since absent from adjacency list", slog.F("name", node.Name()))
					delete(ineligibleDeps, node.Name())
					eligibleDeps[node.Name()] = node
					continue
				}
			}

			// This should only occur when this node is not a Terraform resource.
			logger.Debug(ctx, "failed to lookup node in adjacency list", slog.F("name", node.Name()))
			continue
		}

		el, inel := buildEligibilityLists(ctx, logger, adjList, nodes)

		// Exceptions: if coder_provisioner or coder_agent are used and do not have any ineligible dependencies
		// then can be referenced.
		if _, ok := ineligibleDeps[node.Name()]; ok {
			if node.Provider == "coder_agent" || node.Resource == "coder_provisioner" {
				// If the resource has been marked ineligible BUT has no ineligible transitive dependencies, then it is safe.
				if len(inel) == 0 {
					delete(ineligibleDeps, node.Name())
					eligibleDeps[node.Name()] = node
				}
			}
		}

		if _, ok := eligibleDeps[node.Name()]; ok && len(inel) > 0 {
			delete(eligibleDeps, node.Name())
			ineligibleDeps[node.Name()] = node
		}

		// TODO: check this logic
		for k, v := range inel {
			if _, ok := eligibleDeps[k]; ok {
				delete(eligibleDeps, k)
				continue
			}
			if _, ok := ineligibleDeps[k]; ok {
				continue
			}
			ineligibleDeps[k] = v
			continue
		}
		for k, v := range el {
			if _, ok := eligibleDeps[k]; ok {
				continue
			}
			if _, ok := ineligibleDeps[k]; ok {
				continue
			}
			eligibleDeps[k] = v
			continue
		}
	}
	return eligibleDeps, ineligibleDeps
}

// visit performs a depth-first search to find all connected nodes.
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
	Original  string
	Graph     string `json:"graph,omitempty"`
	Provider  string `json:"prov,omitempty"`
	Resource  string `json:"res,omitempty"`
	Attribute string `json:"attr,omitempty"`
}

func parseName(name string) (*resourceDesc, error) {
	var parser = regexp.MustCompile(`"?(?P<graph>^[^\]]+]\s+)?(?P<prov>[^\.]+)\.(?P<res>[^\.]+)(?:\.(?P<attr>[^\.]+))?"?.+`)
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

	blah.Original = name

	return &blah, nil
}

func (r resourceDesc) Name() string {
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
