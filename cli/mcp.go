package cli

import (
	"encoding/json"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/coder/coder/v2/cli/mcp"
	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/serpent"
	"github.com/mark3labs/mcp-go/server"
	"golang.org/x/xerrors"
)

func (r *RootCmd) mcp() *serpent.Command {
	cmd := &serpent.Command{
		Use:   "mcp",
		Short: "Run the Coder MCP server and configure it to work with AI tools.",
		Long:  "The Coder MCP server allows you to automatically create workspaces with parameters.",
		Children: []*serpent.Command{
			r.mcpConfigure(),
			r.mcpServer(),
		},
	}
	return cmd
}

func (r *RootCmd) mcpServer() *serpent.Command {
	var mcpServerAgent bool
	client := new(codersdk.Client)
	cmd := &serpent.Command{
		Use:   "server",
		Short: "Start the Coder MCP server.",
		Options: serpent.OptionSet{
			serpent.Option{
				Flag:        "agent",
				Env:         "CODER_MCP_SERVER_AGENT",
				Description: "Start the MCP server in agent mode, with a different set of tools.",
				Value:       serpent.BoolOf(&mcpServerAgent),
			},
		},
		Handler: func(inv *serpent.Invocation) error {
			srv := mcp.New(inv.Context(), func() (*codersdk.Client, error) {
				conf := r.createConfig()
				var err error
				// Read the client URL stored on disk.
				if r.clientURL == nil || r.clientURL.String() == "" {
					rawURL, err := conf.URL().Read()
					// If the configuration files are absent, the user is logged out
					if os.IsNotExist(err) {
						return nil, xerrors.New(notLoggedInMessage)
					}
					if err != nil {
						return nil, err
					}

					r.clientURL, err = url.Parse(strings.TrimSpace(rawURL))
					if err != nil {
						return nil, err
					}
				}
				// Read the token stored on disk.
				if r.token == "" {
					r.token, err = conf.Session().Read()
					// Even if there isn't a token, we don't care.
					// Some API routes can be unauthenticated.
					if err != nil && !os.IsNotExist(err) {
						return nil, err
					}
				}

				err = r.configureClient(inv.Context(), client, r.clientURL, inv)
				if err != nil {
					return nil, err
				}
				client.SetSessionToken(r.token)
				if r.debugHTTP {
					client.PlainLogger = os.Stderr
					client.SetLogBodies(true)
				}
				client.DisableDirectConnections = r.disableDirect
				return client, nil
			}, &mcp.Options{})
			return server.ServeStdio(srv)
		},
	}
	return cmd
}

func (r *RootCmd) mcpConfigure() *serpent.Command {
	cmd := &serpent.Command{
		Use:   "configure",
		Short: "Automatically configure the MCP server.",
		Children: []*serpent.Command{
			r.mcpConfigureClaudeDesktop(),
			r.mcpConfigureClaudeCode(),
			r.mcpConfigureCursor(),
		},
	}
	return cmd
}

func (r *RootCmd) mcpConfigureClaudeDesktop() *serpent.Command {
	cmd := &serpent.Command{
		Use:   "claude-desktop",
		Short: "Configure the Claude Desktop server.",
		Handler: func(inv *serpent.Invocation) error {
			configPath, err := os.UserConfigDir()
			if err != nil {
				return err
			}
			configPath = filepath.Join(configPath, "Claude")
			err = os.MkdirAll(configPath, 0755)
			if err != nil {
				return err
			}
			configPath = filepath.Join(configPath, "claude_desktop_config.json")
			_, err = os.Stat(configPath)
			if err != nil {
				if !os.IsNotExist(err) {
					return err
				}
			}
			contents := map[string]any{}
			data, err := os.ReadFile(configPath)
			if err != nil {
				if !os.IsNotExist(err) {
					return err
				}
			} else {
				err = json.Unmarshal(data, &contents)
				if err != nil {
					return err
				}
			}
			binPath, err := os.Executable()
			if err != nil {
				return err
			}
			contents["mcpServers"] = map[string]any{
				"coder": map[string]any{"command": binPath, "args": []string{"mcp", "server"}},
			}
			data, err = json.MarshalIndent(contents, "", "  ")
			if err != nil {
				return err
			}
			err = os.WriteFile(configPath, data, 0644)
			if err != nil {
				return err
			}
			return nil
		},
	}
	return cmd
}

func (r *RootCmd) mcpConfigureClaudeCode() *serpent.Command {
	cmd := &serpent.Command{
		Use:   "claude-code",
		Short: "Configure the Claude Code server.",
		Handler: func(inv *serpent.Invocation) error {
			return nil
		},
	}
	return cmd
}

func (r *RootCmd) mcpConfigureCursor() *serpent.Command {
	var project bool
	cmd := &serpent.Command{
		Use:   "cursor",
		Short: "Configure Cursor to use Coder MCP.",
		Options: serpent.OptionSet{
			serpent.Option{
				Flag:        "project",
				Env:         "CODER_MCP_CURSOR_PROJECT",
				Description: "Use to configure a local project to use the Cursor MCP.",
				Value:       serpent.BoolOf(&project),
			},
		},
		Handler: func(inv *serpent.Invocation) error {
			dir, err := os.Getwd()
			if err != nil {
				return err
			}
			if !project {
				dir, err = os.UserHomeDir()
				if err != nil {
					return err
				}
			}
			cursorDir := filepath.Join(dir, ".cursor")
			err = os.MkdirAll(cursorDir, 0755)
			if err != nil {
				return err
			}
			mcpConfig := filepath.Join(cursorDir, "mcp.json")
			_, err = os.Stat(mcpConfig)
			contents := map[string]any{}
			if err != nil {
				if !os.IsNotExist(err) {
					return err
				}
			} else {
				data, err := os.ReadFile(mcpConfig)
				if err != nil {
					return err
				}
				// The config can be empty, so we don't want to return an error if it is.
				if len(data) > 0 {
					err = json.Unmarshal(data, &contents)
					if err != nil {
						return err
					}
				}
			}
			mcpServers, ok := contents["mcpServers"].(map[string]any)
			if !ok {
				mcpServers = map[string]any{}
			}
			binPath, err := os.Executable()
			if err != nil {
				return err
			}
			mcpServers["coder"] = map[string]any{
				"command": binPath,
				"args":    []string{"mcp", "server"},
			}
			contents["mcpServers"] = mcpServers
			data, err := json.MarshalIndent(contents, "", "  ")
			if err != nil {
				return err
			}
			err = os.WriteFile(mcpConfig, data, 0644)
			if err != nil {
				return err
			}
			return nil
		},
	}
	return cmd
}
