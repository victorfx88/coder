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

var (
	preselection string
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

	cmd.Options = serpent.OptionSet{
		{
			Flag:          "selections",
			FlagShorthand: "s",
			Description:   "Pre-selected resources in CSV format.",
			Value:         serpent.StringOf(&preselection),
		},
	}

	return cmd
}

type adjacencyList map[string][]*gographviz.Node

type ineligibilityReason string

var (
	reasonDatasourceDisallowed ineligibilityReason = "datasource is disallowed"
	reasonDependencyDisallowed ineligibilityReason = "resource depends on disallowed entity"
)

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
		node := graph.Nodes.Lookup[name]

		resource, err := parseName(node)
		if err != nil {
			logger.Warn(ctx, "failed to parse node name", slog.F("name", name), slog.Error(err))
			continue
		}

		switch {
		// Datasources cannot be prebuilt.
		case resource.Type == "data":
			continue
		default:
			eligible = append(eligible, resource.Name())
		}
	}

	// Iterate over all nodes to build up adjacency list
	for _, name := range nodes {
		var deps []*gographviz.Node

		node := graph.Nodes.Lookup[name]

		resource, err := parseName(node)
		if err != nil {
			continue
		}

		edges, ok := graph.Edges.SrcToDsts[name]
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

	var selected []string
	if preselection == "" {
		selected, err = cliui.MultiSelect(inv, cliui.MultiSelectOptions{
			Message:  "Choose which resources you would like to prebuild",
			Options:  eligible,
			Defaults: eligible, // []string{"aws_instance.workspace"},
		})
		if err != nil {
			logger.Error(ctx, "Error choosing resources to evaluate for prebuildability", slog.Error(err))
			return
		}
	} else {
		selected = strings.Split(preselection, ",")
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
				var culprits []string
				for _, n := range res.nodes {
					culprits = append(culprits, n.Name())
				}

				var fields = []any{slog.F("dependency", res.Name()), slog.F("reason", res.reason)}
				if len(culprits) > 0 {
					fields = append(fields, slog.F("culprits", strings.Join(culprits, ", ")))
				}

				logger.Info(ctx, "ineligible", fields...)
			}
		}
	}
}

type ineligibleResource struct {
	*resourceDesc

	reason ineligibilityReason
	nodes  []*resourceDesc
}

func buildEligibilityLists(ctx context.Context, logger slog.Logger, adjList adjacencyList, deps []*gographviz.Node) (map[string]*resourceDesc, map[string]*ineligibleResource) {
	ineligibleDeps := make(map[string]*ineligibleResource, len(deps))
	eligibleDeps := make(map[string]*resourceDesc, len(deps))

	for _, dep := range deps {
		node, err := parseName(dep)
		if err != nil {
			logger.Error(ctx, "failed to parse node name", slog.F("name", dep.Name), slog.Error(err))
			continue
		}

		switch {
		case node.Type == "data" && strings.Index(node.Resource, "coder_") == 0:
			ineligibleDeps[node.Name()] = &ineligibleResource{resourceDesc: node, reason: reasonDatasourceDisallowed}
		default:
			eligibleDeps[node.Name()] = node
		}

		// Recurse to determine if any dependencies' transitive dependencies are ineligible.
		nodes, ok := adjList[node.Name()]
		if !ok {
			// Exception: if this node matches any of the follow clauses and itself has no dependencies, then it will
			// not be included in the adjacency list. If it has no dependencies then it is safe to use.
			if node.Type == "coder_agent" || node.Resource == "coder_provisioner" {
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
			if node.Type == "coder_agent" || node.Resource == "coder_provisioner" {
				// If the resource has been marked ineligible BUT has no ineligible transitive dependencies, then it is safe.
				if len(inel) == 0 {
					delete(ineligibleDeps, node.Name())
					eligibleDeps[node.Name()] = node
				}
			}
		}

		if _, ok := eligibleDeps[node.Name()]; ok && len(inel) > 0 {
			delete(eligibleDeps, node.Name())
			var list []*resourceDesc
			for _, v := range inel {
				list = append(list, v.resourceDesc)
			}
			ineligibleDeps[node.Name()] = &ineligibleResource{resourceDesc: node, reason: reasonDependencyDisallowed, nodes: list}
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
	Original     *gographviz.Node
	ModuleName   string
	Graph        string `json:"graph,omitempty"`
	Type         string `json:"type,omitempty"`
	Resource     string `json:"name,omitempty"`
	Attribute    string `json:"attr,omitempty"`
	Subattribute string `json:"subattr,omitempty"`
}

func parseName(node *gographviz.Node) (*resourceDesc, error) {
	name := strings.Trim(node.Name, `"`)

	modName, newName, err := checkModule(name)
	if modName != "" && err == nil {
		name = newName
	}

	resPattern := regexp.MustCompile(`(?P<type>[^\.]+)\.(?P<name>[^\.]+)(?:\.(?P<attr>[^\.]+))?(?:\.(?P<subattr>[^\.]+)?)?.*`)
	names := resPattern.SubexpNames()
	matches := resPattern.FindStringSubmatch(name)
	if len(matches) != len(names) {
		return nil, xerrors.Errorf("%q: no matches", name)
	}

	res := make(map[string]string)
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

	var desc resourceDesc
	if err := json.Unmarshal(out, &desc); err != nil {
		return nil, err
	}

	desc.Original = node
	desc.ModuleName = modName

	return &desc, nil
}

// checkModule takes a given resource name and determines if it belongs to a module.
// If it does, return true and trim the module prefix of the resource name.
func checkModule(name string) (string, string, error) {
	modPattern := regexp.MustCompile(`(?P<module>(?P<type>[^\.]+)\.(?P<name>[^\.]+)\.)(?P<rest>.*)`)
	names := modPattern.SubexpNames()
	matches := modPattern.FindStringSubmatch(name)
	if len(matches) != len(names) {
		return "", "", xerrors.Errorf("%q: no matches", name)
	}

	// 2=type
	if matches[2] != "module" {
		return "", "", nil
	}

	// 3=name
	return matches[3], modPattern.ReplaceAllString(name, `$rest`), nil
}

func (r resourceDesc) Name() string {
	var segs []string
	if r.ModuleName != "" {
		segs = append(segs, []string{"module", r.ModuleName}...)
	}
	if r.Type != "" {
		segs = append(segs, r.Type)
	}
	if r.Resource != "" {
		segs = append(segs, r.Resource)
	}
	if r.Attribute != "" {
		segs = append(segs, r.Attribute)
	}
	if r.Subattribute != "" {
		segs = append(segs, r.Subattribute)
	}

	return strings.Join(segs, ".")
}
