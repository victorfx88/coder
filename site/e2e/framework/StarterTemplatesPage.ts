import type { Locator, Page } from "@playwright/test";
import { AppPage } from "./AppPage";

export class TemplateGalleryPage extends AppPage {
	constructor(page: Page) {
		super(page);
	}

	async visit(): Promise<void> {
		await this.goto("/templates/starter");
	}

	getBrowseCoderRegistryLink(): Locator {
		// This locator targets an <a> tag with the specific text "Browse Coder Registry".
		// It's placed after the main content of starter templates.
		return this.page.locator('//div[contains(@class, "MuiStack-root")]//a[normalize-space()="Browse Coder Registry"]');
		// A more robust selector might use a data-testid if available.
		// For example: this.page.getByTestId('browse-coder-registry-link');
		// Or: this.page.getByRole('link', { name: 'Browse Coder Registry' });
	}
}
