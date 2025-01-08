package tfsec

import (
	"cdr.dev/slog"
	"context"
	"fmt"
	"github.com/gofrs/flock"
	"golang.org/x/xerrors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Install implements a thread-safe, idempotent tfsec Install
// operation.
func Install(ctx context.Context, log slog.Logger, dir string, wantVersion string) (string, error) {
	err := os.MkdirAll(dir, 0o750)
	if err != nil {
		return "", err
	}

	// Windows requires a separate lock file.
	// See https://github.com/pinterest/knox/blob/master/client/flock_windows.go#L64
	// for precedent.
	lockFilePath := filepath.Join(dir, "lock")
	lock := flock.New(lockFilePath)
	ok, err := lock.TryLockContext(ctx, time.Millisecond*100)
	if !ok {
		return "", xerrors.Errorf("could not acquire flock for %v: %w", lockFilePath, err)
	}
	defer lock.Close()

	binPath := filepath.Join(dir, "tfsec")

	if _, err := os.Stat(binPath); err == nil {
		out, _ := exec.Command(binPath, "--version").Output()
		version := strings.TrimSpace(string(out))
		if version == wantVersion {
			log.Debug(
				ctx,
				"tfsec is already installed and matches the desired version",
				slog.F("binPath", binPath),
				slog.F("version", version),
			)
			return binPath, nil
		}
		log.Warn(
			ctx,
			"existing tfsec binary does not match the desired version, re-downloading",
			slog.F("binPath", binPath),
			slog.F("currentVersion", version),
			slog.F("desiredVersion", wantVersion),
		)
	}

	url := fmt.Sprintf("https://github.com/aquasecurity/tfsec/releases/download/%s/tfsec-%s-%s", wantVersion, runtime.GOOS, runtime.GOARCH)

	resp, err := http.Get(url)
	if err != nil {
		return "", xerrors.Errorf("failed to download tfsec binary from %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", xerrors.Errorf("unexpected HTTP status %d while downloading tfsec binary from %s", resp.StatusCode, url)
	}

	file, err := os.Create(binPath)
	if err != nil {
		return "", xerrors.Errorf("failed to create tfsec binary at %s: %w", binPath, err)
	}
	defer file.Close()

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		return "", xerrors.Errorf("failed to write tfsec binary to %s: %w", binPath, err)
	}

	err = os.Chmod(binPath, 0o755)
	if err != nil {
		return "", xerrors.Errorf("failed to set executable permissions on %s: %w", binPath, err)
	}

	log.Debug(
		ctx,
		"installing tfsec",
		slog.F("dir", dir),
		slog.F("version", wantVersion),
	)

	return binPath, nil
}
