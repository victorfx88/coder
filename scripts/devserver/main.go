package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/coder/coder/v2/scripts/devserver/devcmd"
)

func main() {
	ctx := context.Background()
	ctx, cancel := signal.NotifyContext(ctx, syscall.SIGINT)
	defer cancel()

	err := devcmd.Root().Invoke().WithContext(ctx).WithOS().Run()
	if err != nil {
		_, _ = os.Stderr.WriteString(err.Error() + "\n")
		os.Exit(1)
	}
}
