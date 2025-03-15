import { screen, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserNotificationButton } from "./BrowserNotificationButton";
import { MockUser } from "testHelpers/entities";
import * as API from "api";

// Mock the hooks to provide test data
jest.mock("hooks/useBuildInfo", () => ({
  useBuildInfo: () => ({
    data: {
      notifications_vapid_public_key: "test-vapid-key",
    },
  }),
}));

jest.mock("hooks/useMe", () => ({
  useMe: () => ({
    data: MockUser,
  }),
}));

// Mock the API
jest.mock("api", () => ({
  API: {
    updateUserBrowserNotificationSubscription: jest.fn(),
  },
}));

// Mock service worker registration
Object.defineProperty(window, "navigator", {
  value: {
    serviceWorker: {
      ready: Promise.resolve({
        pushManager: {
          subscribe: jest.fn().mockResolvedValue({
            toJSON: () => ({
              endpoint: "https://example.com/push-endpoint",
              keys: {
                auth: "auth-key",
                p256dh: "p256dh-key",
              },
            }),
          }),
        },
      }),
    },
  },
});

describe("BrowserNotificationButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Notification permissions
    Object.defineProperty(window, "Notification", {
      value: {
        requestPermission: jest.fn().mockResolvedValue("granted"),
        permission: "default",
      },
      writable: true,
    });
  });

  it("renders the button", async () => {
    render(<BrowserNotificationButton />);
    expect(screen.getByText("Enable Notifications")).toBeInTheDocument();
  });

  it("subscribes to notifications when clicked", async () => {
    const user = userEvent.setup();
    render(<BrowserNotificationButton />);
    
    await user.click(screen.getByText("Enable Notifications"));
    
    await waitFor(() => {
      expect(Notification.requestPermission).toHaveBeenCalled();
      expect(API.API.updateUserBrowserNotificationSubscription).toHaveBeenCalledWith(
        MockUser.id,
        {
          subscription: {
            endpoint: "https://example.com/push-endpoint",
            keys: {
              auth: "auth-key",
              p256dh: "p256dh-key",
            },
          },
        }
      );
    });
    
    // Button should now show subscribed
    expect(screen.getByText("Subscribed")).toBeInTheDocument();
  });

  it("shows an error if permission is denied", async () => {
    // Override the mock to reject permission
    Object.defineProperty(window, "Notification", {
      value: {
        requestPermission: jest.fn().mockResolvedValue("denied"),
        permission: "default",
      },
      writable: true,
    });

    const user = userEvent.setup();
    render(<BrowserNotificationButton />);
    
    await user.click(screen.getByText("Enable Notifications"));
    
    await waitFor(() => {
      expect(Notification.requestPermission).toHaveBeenCalled();
      expect(screen.getByText(/Notification permission denied/)).toBeInTheDocument();
    });
  });
});