// Default user credentials for E2E tests
// It's recommended to use environment variables for sensitive data
// For simplicity in this example, we're hardcoding them.
export const USER_USERNAME = process.env.CODER_E2E_USERNAME || "e2e-user";
export const USER_PASSWORD = process.env.CODER_E2E_PASSWORD || "e2e-password";

// Default organization name
export const DEFAULT_ORG_NAME = "default";
