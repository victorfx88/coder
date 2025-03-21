package cli

// The "vibe" command is a fun, interactive TUI that demonstrates how to
// build CLI commands with interactive components using the cliui package.
//
// It showcases several key TUI components:
// 1. Text output with styling (Bold)
// 2. Select dropdown for single-choice selection
// 3. Prompt for free text input
// 4. MultiSelect for selecting multiple options
//
// This serves as a good reference for building new interactive CLI commands.

import (
	"fmt"

	"github.com/coder/coder/v2/cli/cliui"
	"github.com/coder/serpent"
)

func (r *RootCmd) vibe() *serpent.Command {
	cmd := &serpent.Command{
		Use:   "vibe",
		Short: "Check the vibe of your workspace",
		Long:  "Interactive TUI to check and set the vibe of your workspace.",
		Handler: func(inv *serpent.Invocation) error {
			// Welcome message
			_, _ = fmt.Fprintln(inv.Stdout, cliui.Bold("Welcome to the Coder Vibe Checker!"))
			_, _ = fmt.Fprintln(inv.Stdout, "Let's see how your workspace is feeling today.")
			
			// Select vibe status
			vibeStatus, err := cliui.Select(inv, cliui.SelectOptions{
				Message: "How's the vibe today?",
				Options: []string{
					"Excellent ✨",
					"Good 😊",
					"Neutral 😐",
					"Bad 😞",
					"Catastrophic 🔥",
				},
				Default: "Neutral 😐",
			})
			if err != nil {
				return err
			}
			
			// Get more details
			details, err := cliui.Prompt(inv, cliui.PromptOptions{
				Text: "Any additional details to share?",
			})
			if err != nil {
				return err
			}
			
			// Select improvement options
			improvements, err := cliui.MultiSelect(inv, cliui.MultiSelectOptions{
				Message: "What would improve your vibe?",
				Options: []string{
					"Faster loading times",
					"More memory",
					"More CPU",
					"Better IDE integration",
					"Improved network speeds",
					"Better documentation",
					"Other",
				},
			})
			if err != nil {
				return err
			}
			
			// Display confirmation
			_, _ = fmt.Fprintln(inv.Stdout, cliui.Bold("\nVibe Check Results:"))
			_, _ = fmt.Fprintf(inv.Stdout, "Current Vibe: %s\n", vibeStatus)
			if details != "" {
				_, _ = fmt.Fprintf(inv.Stdout, "Details: %s\n", details)
			}
			if len(improvements) > 0 {
				_, _ = fmt.Fprintf(inv.Stdout, "Improvements: %s\n", improvements)
			}
			
			// Exit message
			_, _ = fmt.Fprintln(inv.Stdout, cliui.Bold("\nThanks for checking your vibe! Stay groovy. 🎵"))
			
			return nil
		},
	}
	
	return cmd
}