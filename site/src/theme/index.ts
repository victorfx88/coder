// biome-ignore lint/nursery/noRestrictedImports: We still use `Theme` as a basis for our actual theme, for now.
import type { Theme as MuiTheme } from "@mui/material/styles";
import type * as monaco from "monaco-editor";
import type { Branding } from "./branding";
import dark from "./dark";
import type { NewTheme } from "./experimental";
import type { ExternalImageModeStyles } from "./externalImages";
import light from "./light";
import type { Roles } from "./roles";
import { generateCustomTheme as createCustomTheme, getCustomThemeFromLocalStorage, hasCustomTheme } from "../utils/themeGenerator";

export interface Theme extends Omit<MuiTheme, "palette"> {
	/** @deprecated prefer `theme.roles` when possible */
	palette: MuiTheme["palette"];

	/** Sets of colors that can be used based on the role that a UI element serves
	 * for the user.
	 * Does it signify an error? a warning? that something is currently running? etc.
	 */
	roles: Roles;

	/** Theme properties that we're testing out but haven't committed to. */
	experimental: NewTheme;

	/** Theme colors related to marketing */
	branding: Branding;

	monaco: monaco.editor.IStandaloneThemeData;
	externalImages: ExternalImageModeStyles;
}

export const DEFAULT_THEME = "dark";

// We'll use the standard themes as the base, ensuring type safety
const resolveCustomTheme = (mode: "light" | "dark"): Theme => {
	// Start with the default theme to ensure all properties exist
	const defaultTheme = mode === "light" ? light : dark;
	
	// Only attempt customization in browser environments with saved preferences
	if (typeof window !== "undefined" && hasCustomTheme()) {
		const primaryColor = getCustomThemeFromLocalStorage();
		if (primaryColor) {
			try {
				// Use the theme generator to create a custom theme
				// This will preserve all required properties using a more robust cloning approach
				const customTheme = createCustomTheme(primaryColor, mode);
				return customTheme;
			} catch (error: unknown) {
				console.error(`Error creating custom ${mode} theme:`, error);
				// Fall back to default theme on error
				
				// Clear the invalid custom theme from localStorage if it causes consistent errors
				if (error instanceof TypeError || 
					(error !== null && 
					typeof error === 'object' && 
					'name' in error && 
					(error as {name: unknown}).name === "DataCloneError")) {
					if (typeof localStorage !== 'undefined') {
						localStorage.removeItem("customThemePrimaryColor");
						console.warn("Removed invalid custom theme from localStorage");
					}
				}
			}
		}
	}
	
	// Return the default theme if no customization is available or an error occurred
	return defaultTheme;
};

// Initialize the themes using our resolver function
const customLightTheme = resolveCustomTheme("light");
const customDarkTheme = resolveCustomTheme("dark");

// Function to dynamically generate a custom theme - re-export from themeGenerator
// Export the custom theme generator with a more specific return type and error handling
export const generateCustomTheme = (color: string, mode: "light" | "dark"): Theme => {
  try {
    const customTheme = createCustomTheme(color, mode);
    return customTheme;
  } catch (error: unknown) {
    console.error(`Error generating custom ${mode} theme:`, error);
    
    // Remove invalid theme data if there's a consistent error
    if (error instanceof TypeError || 
      (error !== null && 
      typeof error === 'object' && 
      'name' in error && 
      (error as {name: unknown}).name === "DataCloneError")) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem("customThemePrimaryColor");
        console.warn("Removed invalid custom theme from localStorage due to error");
      }
    }
    
    // Return the default theme if generation fails
    return mode === "light" ? light : dark;
  }
};

const theme = {
	dark: customDarkTheme,
	light: customLightTheme,
} satisfies Record<string, Theme>;

export default theme;
