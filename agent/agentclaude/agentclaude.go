package agentclaude

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/spf13/afero"
	"golang.org/x/xerrors"
)

func New(ctx context.Context, apiKey, systemPrompt, taskPrompt string, onWaiting func(waiting bool)) error {
	claudePath, err := exec.LookPath("claude")
	if err != nil {
		return xerrors.Errorf("claude not found: %w", err)
	}
	fs := afero.NewOsFs()
	err = injectClaudeMD(fs, `YOU MUST REPORT YOUR STATUS IMMEDIATELY AFTER EACH USER MESSAGE.

INTERRUPT READING FILES OR ANY OTHER TOOL CALL IF YOU HAVE NOT REPORTED A STATUS YET.

You MUST use the mcp__coder-agent__report_status function with all required parameters:
- summary: Short description of what you're doing
- link: A relevant link for the status
- done: Boolean indicating if the task is complete (true/false)
- emoji: Relevant emoji for the status

WHEN TO REPORT (MANDATORY):
1. IMMEDIATELY after receiving ANY user message, before any other actions
2. After completing any task
3. When making significant progress
4. When encountering roadblocks
5. When asking questions
6. Before and after using search tools or making code changes

FAILING TO REPORT STATUS PROPERLY WILL RESULT IN INCORRECT BEHAVIOR.
`, systemPrompt, "")
	if err != nil {
		return xerrors.Errorf("failed to inject claude md: %w", err)
	}

	wd, err := os.Getwd()
	if err != nil {
		return xerrors.Errorf("failed to get working directory: %w", err)
	}

	err = configureClaude(fs, ClaudeConfig{
		ConfigPath:       "",
		ProjectDirectory: wd,
		APIKey:           apiKey,
		AllowedTools:     []string{},
		MCPServers: map[string]ClaudeConfigMCP{
			"coder-agent": {
				Command: "coder",
				Args:    []string{"agent", "mcp"},
				Env: map[string]string{
					"CODER_AGENT_TOKEN": os.Getenv("CODER_AGENT_TOKEN"),
				},
			},
		},
	})
	if err != nil {
		return xerrors.Errorf("failed to configure claude: %w", err)
	}

	cmd := exec.CommandContext(ctx, claudePath, "--dangerously-skip-permissions", taskPrompt)
	// Create a simple wrapper that starts monitoring only after first write
	stdoutWriter := &delayedPauseWriter{
		writer:      os.Stdout,
		pauseWindow: 2 * time.Second,
		onWaiting:   onWaiting,
		cooldown:    15 * time.Second,
	}
	stderrWriter := &delayedPauseWriter{
		writer:      os.Stderr,
		pauseWindow: 2 * time.Second,
		onWaiting:   onWaiting,
		cooldown:    15 * time.Second,
	}

	cmd.Stdout = stdoutWriter
	cmd.Stderr = stderrWriter
	cmd.Stdin = os.Stdin

	return cmd.Run()
}

// delayedPauseWriter wraps an io.Writer and only starts monitoring for pauses after first write
type delayedPauseWriter struct {
	writer        io.Writer
	pauseWindow   time.Duration
	cooldown      time.Duration
	onWaiting     func(waiting bool)
	lastWrite     time.Time
	mu            sync.Mutex
	started       bool
	waitingState  bool
	cooldownUntil time.Time
}

// Write implements io.Writer and starts monitoring on first write
func (w *delayedPauseWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	firstWrite := !w.started
	w.started = true
	w.lastWrite = time.Now()

	// If we were in waiting state, we're now resumed
	if w.waitingState {
		w.waitingState = false
		w.cooldownUntil = time.Now().Add(w.cooldown)
		w.onWaiting(false) // Signal resume
	}

	w.mu.Unlock()

	// Start monitoring goroutine on first write
	if firstWrite {
		go w.monitorPauses()
	}

	return w.writer.Write(p)
}

// monitorPauses checks for pauses in writing and calls onWaiting when detected
func (w *delayedPauseWriter) monitorPauses() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		w.mu.Lock()

		// Check if we're in a cooldown period
		inCooldown := time.Now().Before(w.cooldownUntil)
		elapsed := time.Since(w.lastWrite)
		shouldWait := elapsed >= w.pauseWindow && !inCooldown
		currentState := w.waitingState
		shouldNotify := false

		// Only update state if it changed
		if shouldWait != currentState {
			w.waitingState = shouldWait
			shouldNotify = true
		}

		w.mu.Unlock()

		// Notify outside of the lock to avoid deadlocks
		if shouldNotify {
			w.onWaiting(shouldWait)
		}
	}
}

func injectClaudeMD(fs afero.Fs, coderPrompt, systemPrompt string, configPath string) error {
	if configPath == "" {
		configPath = filepath.Join(os.Getenv("HOME"), ".claude", "CLAUDE.md")
	}
	_, err := fs.Stat(configPath)
	if err != nil {
		if !os.IsNotExist(err) {
			return xerrors.Errorf("failed to stat claude config: %w", err)
		}
	}
	content := ""
	if err == nil {
		contentBytes, err := afero.ReadFile(fs, configPath)
		if err != nil {
			return xerrors.Errorf("failed to read claude config: %w", err)
		}
		content = string(contentBytes)
	}

	// Define the guard strings
	const coderPromptStartGuard = "<coder-prompt>"
	const coderPromptEndGuard = "</coder-prompt>"
	const systemPromptStartGuard = "<system-prompt>"
	const systemPromptEndGuard = "</system-prompt>"

	// Extract the content without the guarded sections
	cleanContent := content

	// Remove existing coder prompt section if it exists
	coderStartIdx := indexOf(cleanContent, coderPromptStartGuard)
	coderEndIdx := indexOf(cleanContent, coderPromptEndGuard)
	if coderStartIdx != -1 && coderEndIdx != -1 && coderStartIdx < coderEndIdx {
		beforeCoderPrompt := cleanContent[:coderStartIdx]
		afterCoderPrompt := cleanContent[coderEndIdx+len(coderPromptEndGuard):]
		cleanContent = beforeCoderPrompt + afterCoderPrompt
	}

	// Remove existing system prompt section if it exists
	systemStartIdx := indexOf(cleanContent, systemPromptStartGuard)
	systemEndIdx := indexOf(cleanContent, systemPromptEndGuard)
	if systemStartIdx != -1 && systemEndIdx != -1 && systemStartIdx < systemEndIdx {
		beforeSystemPrompt := cleanContent[:systemStartIdx]
		afterSystemPrompt := cleanContent[systemEndIdx+len(systemPromptEndGuard):]
		cleanContent = beforeSystemPrompt + afterSystemPrompt
	}

	// Trim any leading whitespace from the clean content
	cleanContent = strings.TrimSpace(cleanContent)

	// Create the new content with both prompts prepended
	var newContent string

	// Add coder prompt
	newContent = coderPromptStartGuard + "\n" + coderPrompt + "\n" + coderPromptEndGuard + "\n\n"

	// Add system prompt
	newContent += systemPromptStartGuard + "\n" + systemPrompt + "\n" + systemPromptEndGuard + "\n\n"

	// Add the rest of the content
	if cleanContent != "" {
		newContent += cleanContent
	}

	err = fs.MkdirAll(filepath.Dir(configPath), 0755)
	if err != nil {
		return xerrors.Errorf("failed to create claude config directory: %w", err)
	}

	// Write the updated content back to the file
	err = afero.WriteFile(fs, configPath, []byte(newContent), 0644)
	if err != nil {
		return xerrors.Errorf("failed to write claude config: %w", err)
	}

	return nil
}

// indexOf returns the index of the first instance of substr in s,
// or -1 if substr is not present in s.
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

type ClaudeConfig struct {
	ConfigPath       string
	ProjectDirectory string
	APIKey           string
	AllowedTools     []string
	MCPServers       map[string]ClaudeConfigMCP
}

type ClaudeConfigMCP struct {
	Command string            `json:"command"`
	Args    []string          `json:"args"`
	Env     map[string]string `json:"env"`
}

func configureClaude(fs afero.Fs, cfg ClaudeConfig) error {
	if cfg.ConfigPath == "" {
		cfg.ConfigPath = filepath.Join(os.Getenv("HOME"), ".claude.json")
	}
	var config map[string]any
	_, err := fs.Stat(cfg.ConfigPath)
	if err != nil {
		if os.IsNotExist(err) {
			config = make(map[string]any)
		} else {
			return xerrors.Errorf("failed to stat claude config: %w", err)
		}
	}
	if err == nil {
		jsonBytes, err := afero.ReadFile(fs, cfg.ConfigPath)
		if err != nil {
			return xerrors.Errorf("failed to read claude config: %w", err)
		}
		err = json.Unmarshal(jsonBytes, &config)
		if err != nil {
			return xerrors.Errorf("failed to unmarshal claude config: %w", err)
		}
	}

	if cfg.APIKey != "" {
		// Stops Claude from requiring the user to generate
		// a Claude-specific API key.
		config["primaryApiKey"] = cfg.APIKey
	}
	// Stops Claude from asking for onboarding.
	config["hasCompletedOnboarding"] = true
	// Stops Claude from asking for permissions.
	config["bypassPermissionsModeAccepted"] = true
	config["autoUpdaterStatus"] = "disabled"

	projects, ok := config["projects"].(map[string]any)
	if !ok {
		projects = make(map[string]any)
	}

	project, ok := projects[cfg.ProjectDirectory].(map[string]any)
	if !ok {
		project = make(map[string]any)
	}

	allowedTools, ok := project["allowedTools"].([]string)
	if !ok {
		allowedTools = []string{}
	}

	// Add cfg.AllowedTools to the list if they're not already present.
	for _, tool := range cfg.AllowedTools {
		for _, existingTool := range allowedTools {
			if tool == existingTool {
				continue
			}
		}
		allowedTools = append(allowedTools, tool)
	}
	project["allowedTools"] = allowedTools
	project["hasTrustDialogAccepted"] = true
	project["hasCompletedProjectOnboarding"] = true

	mcpServers, ok := project["mcpServers"].(map[string]any)
	if !ok {
		mcpServers = make(map[string]any)
	}
	for name, mcp := range cfg.MCPServers {
		mcpServers[name] = mcp
	}
	project["mcpServers"] = mcpServers
	// Prevents Claude from asking the user to complete the project onboarding.
	project["hasCompletedProjectOnboarding"] = true

	history, ok := project["history"].([]string)
	injectedHistoryLine := "make sure to read claude.md and report tasks properly"

	if !ok || len(history) == 0 {
		// History doesn't exist or is empty, create it with our injected line
		history = []string{injectedHistoryLine}
	} else {
		// Check if our line is already the first item
		if history[0] != injectedHistoryLine {
			// Prepend our line to the existing history
			history = append([]string{injectedHistoryLine}, history...)
		}
	}
	project["history"] = history

	projects[cfg.ProjectDirectory] = project
	config["projects"] = projects

	jsonBytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return xerrors.Errorf("failed to marshal claude config: %w", err)
	}
	err = afero.WriteFile(fs, cfg.ConfigPath, jsonBytes, 0644)
	if err != nil {
		return xerrors.Errorf("failed to write claude config: %w", err)
	}
	return nil
}
