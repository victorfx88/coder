package devcmd

import (
	"cdr.dev/slog"
	"cdr.dev/slog/sloggers/sloghuman"
	"github.com/coder/serpent"
)

func CLILogger(loggerPtr *slog.Logger) func(next serpent.HandlerFunc) serpent.HandlerFunc {
	return func(next serpent.HandlerFunc) serpent.HandlerFunc {
		return func(i *serpent.Invocation) error {
			logger := slog.Make(sloghuman.Sink(i.Stderr)).Leveled(slog.LevelInfo)
			if verbose, _ := i.ParsedFlags().GetBool("verbose"); verbose {
				logger = logger.Leveled(slog.LevelDebug)
				logger.Debug(i.Context(), "debug logging enabled")
			}
			*loggerPtr = logger

			return next(i)
		}
	}
}
