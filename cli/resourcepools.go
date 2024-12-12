package cli

import (
	"bytes"
	"fmt"
	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/coder/v2/provisionersdk"
	"github.com/coder/serpent"
	"golang.org/x/xerrors"
	"os"
)

func (r *RootCmd) resourcePools() *serpent.Command {
	var (
		templateDir string
		capacity    int64
		name        string
	)
	client := new(codersdk.Client)
	// Define the subcommand within the root command
	cmd := &serpent.Command{
		Use:        "resourcepool create",
		Short:      "Create a resource pool",
		Long:       "Create a resource pool by sending configuration to the API endpoint.",
		Middleware: serpent.Chain(r.InitClient(client)),
		Handler: func(inv *serpent.Invocation) error {
			_, err := os.Stat(templateDir)
			if err != nil {
				return xerrors.Errorf("read template dir %q: %w", templateDir, err)
			}

			var out bytes.Buffer
			err = provisionersdk.Tar(&out, inv.Logger, templateDir, 10<<20) // 10MiB
			if err != nil {
				return xerrors.Errorf("package template dir %q: %w", err)
			}

			// TODO: support multi-org
			rp, err := client.CreateResourcePool(inv.Context(), "default", codersdk.CreateResourcePoolRequest{
				Name:     name,
				Template: out.String(),
				Capacity: int(capacity),
			})
			if err != nil {
				return xerrors.Errorf("create resource pool failed: %w", err)
			}

			// Print success message
			_, _ = fmt.Fprintf(inv.Stdout, "Resource pool %q (%s) successfully created!\n", name, rp)

			return nil
		},
	}

	// Add flags for the subcommand
	cmd.Options = []serpent.Option{
		{
			Flag:          "name",
			FlagShorthand: "n",
			Description:   "Name of the resourcepool.",
			Value:         serpent.StringOf(&name),
			Required:      true,
		},
		{
			Flag:          "template-dir",
			FlagShorthand: "f",
			Description:   "Path to the resource pool template dir.",
			Value:         serpent.StringOf(&templateDir),
			Required:      true,
		},
		{
			Flag:          "capacity",
			FlagShorthand: "c",
			Description:   "Capacity of the resource pool (integer).",
			Value:         serpent.Int64Of(&capacity),
			Required:      true,
		},
	}

	return cmd
}
