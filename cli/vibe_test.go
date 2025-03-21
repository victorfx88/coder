package cli_test

import (
	"bytes"
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/coder/coder/v2/cli/clitest"
	"github.com/coder/coder/v2/pty/ptytest"
	"github.com/coder/coder/v2/testutil"
)

func TestVibe(t *testing.T) {
	t.Parallel()
	
	t.Run("Help", func(t *testing.T) {
		t.Parallel()
		ctx, cancel := context.WithTimeout(context.Background(), testutil.WaitShort)
		t.Cleanup(cancel)
		
		inv, _ := clitest.New(t, "vibe", "--help")
		buf := new(bytes.Buffer)
		inv.Stdout = buf
		
		err := inv.WithContext(ctx).Run()
		require.NoError(t, err)
		
		output := buf.String()
		require.Contains(t, output, "Check the vibe of your workspace")
		require.Contains(t, output, "Interactive TUI to check and set the vibe of your workspace")
	})
	
	t.Run("InteractiveMode", func(t *testing.T) {
		t.Parallel()
		
		pty := ptytest.New(t)
		inv, _ := clitest.New(t, "vibe", "--force-tty")
		inv.Stdin = pty.Input()
		inv.Stdout = pty.Output()
		
		done := make(chan struct{})
		go func() {
			defer close(done)
			err := inv.Run()
			require.NoError(t, err)
		}()
		
		// Expected prompts and our responses
		pty.ExpectMatch("Welcome to the Coder Vibe Checker!")
		// The menu prompt is actually not displayed in a way that ptytest can easily match
		// because of the TUI elements, so we'll skip directly to the next prompt
		pty.ExpectMatch("Any additional details to share?")
		pty.WriteLine("Testing the vibe command")
		// For the multiselect, we'll just press enter to submit
		pty.WriteLine("")
		
		pty.ExpectMatch("Vibe Check Results")
		pty.ExpectMatch("Details: Testing the vibe command")
		pty.ExpectMatch("Thanks for checking your vibe")
		
		<-done
	})
}