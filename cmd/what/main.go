package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

func main() {
	clientID := os.Getenv("CODER_OAUTH2_GITHUB_CLIENT_ID")
	if clientID == "" {
		panic("CODER_OAUTH2_GITHUB_CLIENT_ID environment variable is not set")
	}

	config := oauth2.Config{
		ClientID: clientID,
		Endpoint: github.Endpoint,
		Scopes:   []string{"repo"},
	}

	ctx := context.Background()

	// Request device code
	deviceCode, err := config.DeviceAuth(ctx)
	if err != nil {
		panic(err)
	}
	// Marshal and print deviceCode as JSON
	jsonData, err := json.Marshal(deviceCode)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Device code as JSON:\n%s\n\n", string(jsonData))

	// Convert to base64 and print
	base64Data := base64.StdEncoding.EncodeToString(jsonData)
	fmt.Printf("Device code as base64:\n%s\n\n", base64Data)

	// Display instructions to user
	fmt.Printf("Please visit: %s\n", deviceCode.VerificationURI)
	fmt.Printf("And enter code: %s\n", deviceCode.UserCode)

	// // Wait for user to complete authentication and get token
	// token, err := config.DeviceAccessToken(ctx, deviceCode)
	// if err != nil {
	// 	panic(err)
	// }

	// fmt.Printf("Access token: %s\n", token.AccessToken)
}
