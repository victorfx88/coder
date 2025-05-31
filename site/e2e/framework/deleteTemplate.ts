import type { Page } from "@playwright/test";
import { DEFAULT_ORG_NAME } from "./constants";

/**
 * Deletes a template.
 * This is a simplified version for the E2E test.
 * Assumes user is already logged in.
 */
export async function deleteTemplate(
	page: Page,
	templateName: string,
	organizationName: string = DEFAULT_ORG_NAME,
): Promise<void> {
	let orgPrefix = "";
	if (organizationName && organizationName !== DEFAULT_ORG_NAME) {
		orgPrefix = `/@${organizationName}`;
	}
	await page.goto(`${orgPrefix}/templates`);

	// Wait for the templates table to load
	await page.waitForSelector(`text=${templateName}`, { timeout: 15000 });

	// Find the row with the template name and click the delete button/menu item
	// This is highly dependent on the UI structure.
	// Example: await page.locator(`tr:has-text("${templateName}")`).getByRole('button', { name: 'Delete' }).click();
	// Or, if there's a kebab menu:
	const templateRow = page.locator(`tr:has-text("${templateName}")`);
	if (await templateRow.count() === 0) {
		console.warn(`Template ${templateName} not found for deletion.`);
		return;
	}

	const kebabButton = templateRow.locator('[aria-label*="Actions"], [aria-label*="More"]'); // Common labels for kebab menus
	if (await kebabButton.isVisible()) {
		await kebabButton.click();
		await page.getByRole('menuitem', { name: /Delete/i }).click();
	} else {
		// Fallback if no kebab menu, try direct delete button if that's the UI pattern
		const deleteButton = templateRow.getByRole('button', { name: /Delete/i });
		if (await deleteButton.isVisible()) {
			await deleteButton.click();
		} else {
			throw new Error(`Could not find a way to delete template: ${templateName}. Neither kebab menu nor direct delete button found.`);
		}
	}


	// Confirm deletion in a dialog if one appears
	// Example: await page.getByRole('button', { name: 'Confirm Delete' }).click();
	// Or: await page.locator('text=Are you sure you want to delete').locator('button:has-text("Delete")').click();
	const confirmDialog = page.locator('div[role="dialog"], div[role="alertdialog"]');
	if (await confirmDialog.isVisible()) {
		const confirmButton = confirmDialog.getByRole('button', { name: /Delete|Confirm/i });
		await confirmButton.click();
	}


	// Wait for the template to be removed, e.g., by checking it's no longer in the list
	await expect(page.locator(`text=${templateName}`)).not.toBeVisible({ timeout: 15000 });
}
