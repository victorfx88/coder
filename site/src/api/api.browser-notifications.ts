import type * as TypesGen from "./typesGenerated";
import { API } from "./api";

// Extend the API class with browser notification methods
export class BrowserNotificationsAPI {
  /**
   * Update a user's browser notification subscription
   */
  static async updateUserBrowserNotificationSubscription(
    userId: string,
    request: TypesGen.UpdateUserBrowserNotificationSubscription
  ): Promise<void> {
    const response = await API.axios({
      method: "PUT",
      url: `/api/v2/users/${userId}/browsernotifications`,
      data: request,
    });
    return response.data;
  }
}

// Patch the API class to include our new methods
Object.assign(API, BrowserNotificationsAPI);