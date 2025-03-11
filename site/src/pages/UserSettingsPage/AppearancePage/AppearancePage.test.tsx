import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { API } from "api/api";
import { MockUser } from "testHelpers/entities";
import { renderWithAuth } from "testHelpers/renderHelpers";
import { AppearancePage } from "./AppearancePage";

describe("appearance page", () => {
	it("does nothing when selecting current theme", async () => {
		renderWithAuth(<AppearancePage />);

		jest.spyOn(API, "updateAppearanceSettings").mockResolvedValueOnce({
			...MockUser,
			theme_preference: "dark",
		});

		const dark = await screen.findByText("Dark");
		await userEvent.click(dark);

		// Check if the API was called correctly
		expect(API.updateAppearanceSettings).toBeCalledTimes(0);
	});

	it("changes theme to light", async () => {
		renderWithAuth(<AppearancePage />);

		jest.spyOn(API, "updateAppearanceSettings").mockResolvedValueOnce({
			...MockUser,
			theme_preference: "light",
		});

		const light = await screen.findByText("Light");
		await userEvent.click(light);

		// Check if the API was called correctly
		expect(API.updateAppearanceSettings).toBeCalledTimes(1);
		expect(API.updateAppearanceSettings).toHaveBeenCalledWith({
			theme_preference: "light",
		});
	});

	it("shows the purple theme option", async () => {
		renderWithAuth(<AppearancePage />);
		
		// Check that the purple option is displayed
		const purple = await screen.findByText("Purple");
		expect(purple).toBeInTheDocument();
	});

	it("changes theme to purple", async () => {
		renderWithAuth(<AppearancePage />);

		jest.spyOn(API, "updateAppearanceSettings").mockResolvedValueOnce({
			...MockUser,
			theme_preference: "purple",
		});

		const purple = await screen.findByText("Purple");
		await userEvent.click(purple);

		// Check if the API was called correctly with purple theme
		expect(API.updateAppearanceSettings).toBeCalledTimes(1);
		expect(API.updateAppearanceSettings).toHaveBeenCalledWith({
			theme_preference: "purple",
		});
	});
});
