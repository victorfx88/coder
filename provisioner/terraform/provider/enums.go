package provider

const (
	// IsPrebuildEnvironmentVariable is an environment variable key Coder injects to
	// indicate that a workspace is running as a prebuild.
	IsPrebuildEnvironmentVariable = "CODER_PREBUILD"

	// RunningAgentTokenEnvironmentVariable is used by Coder in prebuilds to store the agent token.
	RunningAgentTokenEnvironmentVariable = "CODER_AGENT_TOKEN"
)

// WorkspacePreset represents a template preset configuration.
type WorkspacePreset struct {
	ID          string
	Name        string
	Description string
	Prebuild    bool
}
