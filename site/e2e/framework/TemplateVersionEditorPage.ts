import type { Locator, Page } from "@playwright/test";
import { AppPage } from "./AppPage";
import { DEFAULT_ORG_NAME } from "./constants";

export class TemplateVersionEditorPage extends AppPage {
	constructor(page: Page) {
		super(page);
	}

	async visit(templateName: string, versionName: string, organizationName: string = DEFAULT_ORG_NAME): Promise<void> {
		// Adjust the path according to your application's URL structure
		// Example assumes organization might be part of the path or a default is used.
		let path = "";
		if (organizationName && organizationName.toLowerCase() !== "default") {
			path = `/@${organizationName}`;
		}
		await this.goto(`${path}/templates/${templateName}/versions/${versionName}/edit`);
		// Wait for a specific element that indicates the editor page has loaded, e.g., the file tree or editor pane
		await this.page.waitForSelector(".file-tree-container", { state: "visible", timeout: 20000 });
	}

	getBrowseModulesLink(): Locator {
		// This locator targets an <a> tag with the specific text "Browse modules on Coder Registry".
		// It's placed above the "Output" / "Resources" tabs.
		// Using XPath to locate it based on text content and assuming it's within the main content area.
		return this.page.locator('//div[contains(@class, "template-version-editor-main-content")]//a[normalize-space()="Browse modules on Coder Registry"]');
		// A more robust selector might use a data-testid if available.
		// For example: this.page.getByTestId('browse-modules-link');
		// Or: this.page.getByRole('link', { name: 'Browse modules on Coder Registry' });
		// The current structure from the patch was:
		// <div css={{ textAlign: "right", padding: "8px 16px", borderBottom: `1px solid ${theme.palette.divider}` }}>
		//   <a>Browse modules on Coder Registry</a>
		// </div>
		// So, we can refine this:
		// return this.page.locator('//div[contains(@style, "text-align: right")]/a[normalize-space()="Browse modules on Coder Registry"]');
		// For now, using a simpler text-based search within a presumed parent.
		// The actual parent div might need a more specific selector if the page is complex.
		// Let's assume the link is directly identifiable by its text within the broader page structure.
		return this.page.getByRole('link', { name: 'Browse modules on Coder Registry' });
	}
}
