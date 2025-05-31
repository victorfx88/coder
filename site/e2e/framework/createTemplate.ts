import type { Page } from "@playwright/test";
import { DEFAULT_ORG_NAME } from "./constants";

/**
 * Creates a new template.
 * This is a simplified version for the E2E test.
 * Assumes user is already logged in and on a page where they can navigate to template creation.
 */
export async function createTemplate(
	page: Page,
	templateName: string,
	starterTemplateId = "docker", // e.g., "docker", "kubernetes"
	starterTemplateType = "official", // "official" or "organization" or "user"
	organizationName: string = DEFAULT_ORG_NAME,
): Promise<void> {
	let orgPrefix = "";
	if (organizationName && organizationName !== DEFAULT_ORG_NAME) {
		orgPrefix = `/@${organizationName}`;
	}
	await page.goto(`${orgPrefix}/templates/starter`);

	// Click on the starter template card based on its ID (href contains template id)
	// This assumes starter templates are links.
	// Example: await page.locator(`a[href*="/templates/starter/${starterTemplateId}"]`).click();
	// For simplicity, let's assume we navigate directly to the new page from a known starter
	// This is a placeholder and needs to match actual UI flow.
	// Let's assume clicking a "Docker" starter template.
	// This might be more complex if it involves selecting from a list/gallery.

	// This is a common pattern if starter templates are presented as cards with links
	// We'll use a more direct navigation for simplicity of this placeholder
	await page.goto(`${orgPrefix}/templates/new?example_id=${starterTemplateType}%2F${starterTemplateId}`);

	// Wait for the template editor page to load (e.g., the name input is visible)
	await page.waitForSelector('input[name="name"]', { timeout: 15000 });

	// Fill in the template name
	await page.fill('input[name="name"]', templateName);

	// Click "Create" or "Publish" button
	// This highly depends on the UI. Let's assume a "Publish" button.
	// In a real scenario, you might need to save, then publish, or just create.
	const publishButton = page.getByRole('button', { name: /Publish|Create/i });
	await publishButton.click();

	// Wait for the template to be created and active, e.g., by checking for its presence on the templates page
	// or by waiting for a success notification.
	// For now, wait for navigation to the template's page or versions page.
	await page.waitForURL(new RegExp(`${orgPrefix}/templates/${templateName}(\/versions\/.*)?$`), { timeout: 30000 });

	// Additional check for active state if possible
	// This might involve checking for "Active" badge or similar status indicator
	// For example: await expect(page.locator('.status-badge-active')).toBeVisible();
	// Or ensuring the editor page for the new version is loaded.
	await page.waitForSelector('text="Template Files"', { timeout: 15000 }); // Assuming this text appears on successful creation/edit page
}
