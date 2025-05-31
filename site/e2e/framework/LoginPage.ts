import type { Page } from "@playwright/test";
import { AppPage } from "./AppPage";

export class LoginPage extends AppPage {
	constructor(page: Page) {
		super(page);
	}

	async login(username: string, password?: string): Promise<void> {
		await this.page.goto("/login");
		await this.page.fill('input[name="login"]', username);
		if (password) {
			await this.page.fill('input[name="password"]', password);
		}
		// Handle potential for enterprise login screen where password might be hidden
		const passwordInput = this.page.locator('input[name="password"]');
		if (await passwordInput.isVisible()) {
			if (!password) {
				throw new Error("Password is required for this login form but was not provided.");
			}
		}
		await this.page.click('button[type="submit"]');
		// Wait for navigation to complete, e.g., by checking for URL change or a dashboard element
		await this.page.waitForURL(this.page.url().startsWith("/@") ? /./ : /\/workspaces$/, { timeout: 30000 });
		await this.waitForAppLoad();
	}

	async ensureLoggedIn(username: string, password?: string): Promise<void> {
		try {
			// Try to go to a page that requires login
			await this.page.goto("/workspaces");
			await this.waitForAppLoad();
			// Check if we're still on the login page or redirected
			if (this.page.url().includes("/login")) {
				await this.login(username, password);
			}
			// Add a check for a dashboard element to be sure
			await this.page.waitForSelector("text=Workspaces", { timeout: 10000 });
		} catch (error) {
			// If any error (e.g. navigation timeout, element not found), try to login
			await this.login(username, password);
		}
	}
}
