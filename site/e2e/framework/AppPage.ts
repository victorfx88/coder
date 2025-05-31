import type { Page } from "@playwright/test";

export class AppPage {
	constructor(public readonly page: Page) {}

	async waitForAppLoad(): Promise<void> {
		// Generic wait for some element that indicates the app has loaded.
		// This might be a Coder logo, a navigation bar, or a specific dashboard element.
		// For now, we'll just wait for the body, but this should be made more robust.
		await this.page.waitForSelector("body", { state: "visible", timeout: 30000 }); // Increased timeout
	}

	async goto(path: string): Promise<void> {
		await this.page.goto(path);
		await this.waitForAppLoad();
	}
}
