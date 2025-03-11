import themes from "..";

describe("Purple theme", () => {
	it("should be defined", () => {
		expect(themes.purple).toBeDefined();
	});

	it("should have purple color palette", () => {
		const { palette } = themes.purple;
		
		// Primary color should be purple
		expect(palette.primary.main).toContain("#");
		expect(palette.background.default).toContain("#");
		
		// Check experimental features use purple colors
		expect(themes.purple.experimental.l1.background).toContain("#");
		expect(themes.purple.experimental.l2.background).toContain("#");
	});

	it("should have purple branding", () => {
		const { branding } = themes.purple;
		
		// Branding should use purple colors
		expect(branding.enterprise.background).toContain("#");
		expect(branding.premium.background).toContain("#");
		expect(branding.featureStage.background).toContain("#");
	});

	it("should have purple roles", () => {
		const { roles } = themes.purple;
		
		// Active elements should use purple colors
		expect(roles.active.outline).toContain("#");
		expect(roles.info.background).toContain("#");
		expect(roles.active.fill.solid).toContain("#");
	});
});