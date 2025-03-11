import createCache from "@emotion/cache";
import { ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { CacheProvider } from "@emotion/react";
import CssBaseline from "@mui/material/CssBaseline";
import {
	ThemeProvider as MuiThemeProvider,
	StyledEngineProvider,
	// biome-ignore lint/nursery/noRestrictedImports: we extend the MUI theme
} from "@mui/material/styles";
import { appearanceSettings } from "api/queries/users";
import { useEmbeddedMetadata } from "hooks/useEmbeddedMetadata";
import {
	type FC,
	type PropsWithChildren,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useQuery } from "react-query";
import themes, { DEFAULT_THEME, generateCustomTheme, type Theme } from "theme";
import { getCustomThemeFromLocalStorage, hasCustomTheme } from "utils/themeGenerator";

/**
 *
 */
export const ThemeProvider: FC<PropsWithChildren> = ({ children }) => {
	const { metadata } = useEmbeddedMetadata();
	const appearanceSettingsQuery = useQuery(
		appearanceSettings(metadata.userAppearance),
	);
	const themeQuery = useMemo(
		() => window.matchMedia?.("(prefers-color-scheme: light)"),
		[],
	);
	const [preferredColorScheme, setPreferredColorScheme] = useState<
		"dark" | "light"
	>(themeQuery?.matches ? "light" : "dark");

	useEffect(() => {
		if (!themeQuery) {
			return;
		}

		const listener = (event: MediaQueryListEvent) => {
			setPreferredColorScheme(event.matches ? "light" : "dark");
		};

		// `addEventListener` here is a recent API that only _very_ up-to-date
		// browsers support, and that isn't mocked in Jest.
		themeQuery.addEventListener?.("change", listener);
		return () => {
			themeQuery.removeEventListener?.("change", listener);
		};
	}, [themeQuery]);

	// We might not be logged in yet, or the `theme_preference` could be an empty string.
	const themePreference =
		appearanceSettingsQuery.data?.theme_preference || DEFAULT_THEME;
	// The janky casting here is find because of the much more type safe fallback
	// We need to support `themePreference` being wrong anyway because the database
	// value could be anything, like an empty string.

	// Track if we need to force a theme refresh
	const [themeUpdateCounter, setThemeUpdateCounter] = useState(0);

	useEffect(() => {
		const root = document.documentElement;
		
		// Determine the actual theme mode (light or dark)
		let actualTheme = themePreference;
		if (themePreference === "auto") {
			actualTheme = preferredColorScheme;
		} else if (themePreference === "custom") {
			// For custom themes, we still need to set either light or dark class
			// based on whether it's a light or dark custom theme
			actualTheme = preferredColorScheme;
		}
		
		root.classList.add(actualTheme);

		// Add listener for custom theme updates
		const handleCustomThemeUpdated = () => {
			// Force a re-render of the theme provider
			setThemeUpdateCounter(prev => prev + 1);
		};

		window.addEventListener('custom-theme-updated', handleCustomThemeUpdated);

		return () => {
			root.classList.remove("light", "dark");
			window.removeEventListener('custom-theme-updated', handleCustomThemeUpdated);
		};
	}, [themePreference, preferredColorScheme]);

	// Determine which theme to use based on preferences and custom themes
	const getThemeToUse = (): Theme => {
		// This will force the function to re-run when themeUpdateCounter changes
		// eslint-disable-next-line no-unused-vars
		const _ = themeUpdateCounter;

		// Check if custom theme from CSS var
		const primaryColorVar = document.documentElement.style.getPropertyValue('--primary-color');
		const hasCustomVar = primaryColorVar && primaryColorVar.length > 0;

		// First check for in-memory custom themes
		if (hasCustomTheme() || hasCustomVar) {
			const primaryColor = getCustomThemeFromLocalStorage() || primaryColorVar || "#6A36FC";
			
			// Select the right mode based on current theme preference
			if (themePreference === "light" || 
			   (themePreference === "auto" && preferredColorScheme === "light")) {
				return generateCustomTheme(primaryColor, "light") as Theme;
			} else {
				return generateCustomTheme(primaryColor, "dark") as Theme;
			}
		}

		// Handle auto theme preference 
		if (themePreference === "auto") {
			return themes[preferredColorScheme];
		}

		// Handle normal theme selection (light, dark)
		return themes[themePreference as keyof typeof themes] ?? themes[preferredColorScheme];
	};

	const theme = getThemeToUse();

	return (
		<StyledEngineProvider injectFirst>
			<ThemeOverride theme={theme}>{children}</ThemeOverride>
		</StyledEngineProvider>
	);
};

// This is being added to allow Tailwind classes to be used with MUI components. https://mui.com/material-ui/integrations/interoperability/#tailwind-css
const cache = createCache({
	key: "css",
	prepend: true,
});

interface ThemeOverrideProps {
	theme: Theme;
	children?: ReactNode;
}

export const ThemeOverride: FC<ThemeOverrideProps> = ({ theme, children }) => {
	return (
		<CacheProvider value={cache}>
			<MuiThemeProvider theme={theme}>
				<EmotionThemeProvider theme={theme}>
					<CssBaseline enableColorScheme />
					{children}
				</EmotionThemeProvider>
			</MuiThemeProvider>
		</CacheProvider>
	);
};
