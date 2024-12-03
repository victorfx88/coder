package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/awalterschulze/gographviz"
	"github.com/coder/serpent"
	"golang.org/x/xerrors"

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
			// ctx, cancel := context.WithCancel(inv.Context())
			// defer cancel()

			// notifyCtx, notifyCancel := inv.SignalNotifyContext(ctx, StopSignals...)
			// defer notifyCancel()

			wd, err := os.Getwd()
			if err != nil {
				panic(err)
			}

			path := filepath.Join(wd, "scratch", "tf.graph")

			f, err := os.ReadFile(path)
			if err != nil {
				panic(err)
			}
			analyze(f)

			return nil
		},
	}

	return cmd
}

func analyze(in []byte) {
	// Parse the DOT data
	graphAst, err := gographviz.ParseString(string(in))
	if err != nil {
		panic(err)
	}

	graph := gographviz.NewGraph()
	if err := gographviz.Analyse(graphAst, graph); err != nil {
		panic(err)
	}

	for name, edges := range graph.Edges.SrcToDsts {
		// if strings.Contains(name, "aws_instance.workspace") {

		visited := make(map[string]struct{})
		deps := make([]*gographviz.Node, 0)

		nn, err := normalizeName(name)
		if err != nil {
			// fmt.Printf("%q: %w", name, err)
			continue
		}
		for en, _ := range edges {
			// fmt.Printf("\t->%s\n", en)
			deps = visit(visited, graph, graph.Nodes.Lookup[en], deps)
		}

		slices.SortFunc(deps, func(a, b *gographviz.Node) int {
			if a == nil || b == nil {
				return 0
			}
			return strings.Compare(a.Name, b.Name)
		})

		if len(deps) == 0 {
			continue
		}

		fmt.Printf("%s:\n", nn)
		for _, dep := range deps {
			depName, err := normalizeName(dep.Name)
			if err != nil {
				// fmt.Printf("ERR (%q): %s\n", dep.Name, err)
				continue
			}

			fmt.Printf("---%s\n", depName)
		}
		// }

		fmt.Println()
	}
}

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

	for name, _ := range neighbours {
		if !isValid(name) {
			continue
		}

		// fmt.Printf(">>>>>%s\n", name)
		return visit(visited, graph, graph.Nodes.Lookup[name], list)
	}

	return list
}

var isProvider = regexp.MustCompile(`\bprovider\[`)

func isValid(name string) bool {
	if isProvider.MatchString(name) {
		return false
	}

	return true
}

type resource struct {
	Graph     string `json:"graph,omitempty"`
	Provider  string `json:"prov,omitempty"`
	Resource  string `json:"res,omitempty"`
	Attribute string `json:"attr,omitempty"`
}

var parser = regexp.MustCompile(`(?P<graph>^[^\]]+]\s+)?(?P<prov>\w+)\.(?P<res>\w+)(?:\.(?P<attr>\w+))?\s*\(expand\)`)

func normalizeName(name string) (*resource, error) {
	names := parser.SubexpNames()

	matches := parser.FindStringSubmatch(name)
	res := make(map[string]string)

	if len(matches) != len(names) {
		return nil, xerrors.Errorf("%q: no matches", name)
	}

	for i := range names[1:] {
		res[names[i]] = matches[i]
	}

	out, err := json.Marshal(res)
	if err != nil {
		return nil, err
	}

	var blah resource
	if err := json.Unmarshal(out, &blah); err != nil {
		return nil, err
	}

	return &blah, nil
}

func (r resource) String() string {
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
