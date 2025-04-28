package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"

	"github.com/coder/coder/v2/codersdk"
	"github.com/coder/coder/v2/codersdk/workspacesdk"
)

// This function demonstrates making an HTTP request to a port in a workspace
func requestWorkspacePort(ctx context.Context, client *workspacesdk.Client, agentID uuid.UUID, port uint16) (string, error) {
	// Create a timeout context
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Establish connection to the agent
	agentConn, err := client.DialAgent(ctx, agentID, &workspacesdk.DialAgentOptions{})
	if err != nil {
		return "", xerrors.Errorf("dial agent: %w", err)
	}
	defer agentConn.Close()

	// Establish a TCP connection to the port on the agent
	conn, err := agentConn.DialContext(ctx, "tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return "", xerrors.Errorf("dial port %d: %w", port, err)
	}
	defer conn.Close()

	// Create an HTTP client that uses our connection
	httpConn := &http.Client{
		Transport: &http.Transport{
			DialContext: func(_ context.Context, _, _ string) (net.Conn, error) {
				return conn, nil
			},
		},
	}

	fmt.Printf("%s: Making HTTP request to %s\n", time.Now().Format(time.RFC3339Nano), fmt.Sprintf("http://127.0.0.1:%d/", port))

	// Make the HTTP request
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("http://127.0.0.1:%d/", port), nil)
	if err != nil {
		return "", xerrors.Errorf("create request: %w", err)
	}

	// Send the request
	resp, err := httpConn.Do(req)
	if err != nil {
		return "", xerrors.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	// Read the response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", xerrors.Errorf("read response: %w", err)
	}

	return string(body), nil
}

func main() {
	coderClient := codersdk.New(&url.URL{
		Scheme: "http",
		Host:   "localhost:8080",
	})

	workspaceClient := workspacesdk.New(coderClient)

	authToken := os.Getenv("CODER_AUTH_TOKEN")
	coderClient.SetSessionToken(authToken)

	agentID := uuid.MustParse("e5989d1a-a884-4923-b608-173a6f2bd025")
	port := uint16(8000)

	fmt.Printf("%s: Requesting workspace port...\n", time.Now().Format(time.RFC3339Nano))
	response, err := requestWorkspacePort(context.Background(), workspaceClient, agentID, port)
	if err != nil {
		log.Fatalf("Failed to request workspace port: %v", err)
	}

	fmt.Printf("%s: Response: %s\n", time.Now().Format(time.RFC3339Nano), response)
}
