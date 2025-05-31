import { expect, test } from "@playwright/test";
import { AppPage } from "../framework/AppPage";
import { LoginPage } from "../framework/LoginPage";
import { TemplateGalleryPage } from "../framework/StarterTemplatesPage";
import { TemplateVersionEditorPage } from "../framework/TemplateVersionEditorPage";
import { USER_PASSWORD, USER_USERNAME } from "../framework/constants";
import { createTemplate } from "../framework/createTemplate";
import { deleteTemplate }s from "../framework/deleteTemplate";

// Note: These tests will require the ability to start the Coder server
// with different environment variables for CODER_DISABLE_REGISTRY_LINKS.
// This might be handled by separate Playwright projects or per-test configurations
// if the test framework supports it. For now, we write them as distinct suites.

const templateName = "e2e-registry-links-test";

test.describe("Registry Links (CODER_DISABLE_REGISTRY_LINKS not set or false)", () => {
	test.use({
		// This assumes a mechanism to set server env vars.
		// If Playwright project config is used, this might not be needed here.
		// This is a placeholder for however the env var is set for this test run.
		// Example: launchOptions: { env: { ...process.env, CODER_DISABLE_REGISTRY_LINKS: "false" } }
	});

	let app: AppPage;
	let loginPage: LoginPage;
	let templateGalleryPage: TemplateGalleryPage;
	let templateVersionEditorPage: TemplateVersionEditorPage;

	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();
		app = new AppPage(page);
		loginPage = new LoginPage(page);
		templateGalleryPage = new TemplateGalleryPage(page);
		templateVersionEditorPage = new TemplateVersionEditorPage(page);

		await loginPage.login(USER_USERNAME, USER_PASSWORD);
		await app.waitForAppLoad();
		// Create a template to navigate to its editor page
		await createTemplate(page, templateName, "nginx", "docker");
		await app.waitForAppLoad();
	});

	test.afterAll(async ({ browser }) => {
		const page = await browser.newPage();
		await new LoginPage(page).login(USER_USERNAME, USER_PASSWORD);
		await deleteTemplate(page, templateName);
		await page.close();
	});

	test("should show 'Browse Coder Registry' link on starter templates page", async ({ page }) => {
		await templateGalleryPage.visit();
		const registryLink = templateGalleryPage.getBrowseCoderRegistryLink();
		await expect(registryLink).toBeVisible();
	});

	test("should show 'Browse modules on Coder Registry' link on template editor page", async ({ page }) => {
		await templateVersionEditorPage.visit(templateName, "1"); // Assuming version "1" or latest
		const modulesLink = templateVersionEditorPage.getBrowseModulesLink();
		await expect(modulesLink).toBeVisible();
	});
});

test.describe("Registry Links (CODER_DISABLE_REGISTRY_LINKS=true)", () => {
	test.use({
		// This assumes a mechanism to set server env vars.
		// Example: launchOptions: { env: { ...process.env, CODER_DISABLE_REGISTRY_LINKS: "true" } }
	});

	let app: AppPage;
	let loginPage: LoginPage;
	let templateGalleryPage: TemplateGalleryPage;
	let templateVersionEditorPage: TemplateVersionEditorPage;

	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();
		app = new AppPage(page);
		loginPage = new LoginPage(page);
		templateGalleryPage = new TemplateGalleryPage(page);
		templateVersionEditorPage = new TemplateVersionEditorPage(page);

		await loginPage.login(USER_USERNAME, USER_PASSWORD);
		await app.waitForAppLoad();
		// Create a template to navigate to its editor page
		await createTemplate(page, templateName + "-disabled", "nginx", "docker");
		await app.waitForAppLoad();
	});

	test.afterAll(async ({ browser }) => {
		const page = await browser.newPage();
		await new LoginPage(page).login(USER_USERNAME, USER_PASSWORD);
		await deleteTemplate(page, templateName + "-disabled");
		await page.close();
	});

	test("should NOT show 'Browse Coder Registry' link on starter templates page", async ({ page }) => {
		await templateGalleryPage.visit();
		const registryLink = templateGalleryPage.getBrowseCoderRegistryLink();
		await expect(registryLink).not.toBeVisible();
	});

	test("should NOT show 'Browse modules on Coder Registry' link on template editor page", async ({ page }) => {
		await templateVersionEditorPage.visit(templateName + "-disabled", "1"); // Assuming version "1" or latest
		const modulesLink = templateVersionEditorPage.getBrowseModulesLink();
		await expect(modulesLink).not.toBeVisible();
	});
});
