import type { Interpolation } from "@emotion/react";
import { visuallyHidden } from "@mui/utils";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormHelperText from "@mui/material/FormHelperText";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { UpdateUserAppearanceSettingsRequest } from "api/typesGenerated";
import { ErrorAlert } from "components/Alert/ErrorAlert";
import { PreviewBadge } from "components/Badges/Badges";
import { Stack } from "components/Stack/Stack";
import { ThemeOverride } from "contexts/ThemeProvider";
import { type FC, useState, useEffect, useRef, useCallback } from "react";
import themes, { DEFAULT_THEME, type Theme } from "theme";
import light from "theme/light";
import dark from "theme/dark";
import { generateCustomTheme as getCustomTheme } from "utils/themeGenerator";
import { saveCustomThemeToLocalStorage, getCustomThemeFromLocalStorage, hasCustomTheme } from "utils/themeGenerator";

export interface AppearanceFormProps {
	isUpdating?: boolean;
	error?: unknown;
	initialValues: UpdateUserAppearanceSettingsRequest;
	onSubmit: (values: UpdateUserAppearanceSettingsRequest) => Promise<unknown>;
}

export const AppearanceForm: FC<AppearanceFormProps> = ({
	isUpdating,
	error,
	onSubmit,
	initialValues,
}) => {
	const currentTheme = initialValues.theme_preference || DEFAULT_THEME;
	const [primaryColor, setPrimaryColor] = useState<string>("#6A36FC"); // Default purple color
	// Use the proper Theme type from the theme directory
	const [customLightTheme, setCustomLightTheme] = useState<Theme | null>(null);
	const [customDarkTheme, setCustomDarkTheme] = useState<Theme | null>(null);
	// Add state for the preview timeout
	const [previewTimeout, setPreviewTimeout] = useState<number | null>(null);

	// Load saved custom theme color if exists and setup event listeners
	useEffect(() => {
		const savedColor = getCustomThemeFromLocalStorage();
		if (savedColor) {
			setPrimaryColor(savedColor);
			// Generate custom themes based on the saved color
			const lightTheme = getCustomTheme(savedColor, "light");
			const darkTheme = getCustomTheme(savedColor, "dark");
			setCustomLightTheme(lightTheme);
			setCustomDarkTheme(darkTheme);
			
			// Set CSS variables for immediate visual feedback
			document.documentElement.style.setProperty('--primary-color', savedColor);
			document.documentElement.style.setProperty('--primary-color-preview', savedColor);
		}
		
		// Setup listener for theme updates to avoid page refreshes
		const handleThemeUpdate = () => {
			// This forces components to re-render with the new theme
			const currentColor = getCustomThemeFromLocalStorage();
			if (currentColor) {
				const lightTheme = getCustomTheme(currentColor, "light");
				const darkTheme = getCustomTheme(currentColor, "dark");
				setCustomLightTheme(lightTheme);
				setCustomDarkTheme(darkTheme);
			}
		};
		
		window.addEventListener('custom-theme-updated', handleThemeUpdate);
		
		// Cleanup
		return () => {
			window.removeEventListener('custom-theme-updated', handleThemeUpdate);
			if (previewTimeout !== null) {
				window.clearTimeout(previewTimeout);
			}
		};
	}, [previewTimeout]);

	const onChangeTheme = async (theme: string) => {
		if (isUpdating) {
			return;
		}

		await onSubmit({ theme_preference: theme });
	};

	// Track if user is actively dragging 
	const [isDragging, setIsDragging] = useState(false);
	
	// Placeholder for the useEffect that will be defined after previewThemeColor
	// We need to move this useEffect after previewThemeColor is defined to fix the TypeScript error
	
	// Extremely optimized color picker with drag detection
	const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newColor = e.target.value;
		setPrimaryColor(newColor);
		
		// First time we get a change, user has started dragging
		if (!isDragging) {
			setIsDragging(true);
			// Cancel any pending previews
			if (previewTimeout !== null) {
				window.clearTimeout(previewTimeout);
				setPreviewTimeout(null);
			}
		}
		
		// ONLY update CSS variables during drag - no theme generation at all
		// This is extremely fast and keeps the UI responsive
		document.documentElement.style.setProperty('--primary-color-preview', newColor);
		document.getElementById('apply-color-button')?.style.setProperty('background-color', newColor);
	};

	const applyCustomTheme = () => {
		// Use the button background color's CSS var for immediate feedback
		document.documentElement.style.setProperty('--primary-color-preview', primaryColor);
		
		// Save the custom color to localStorage
		saveCustomThemeToLocalStorage(primaryColor);
		
		// Generate themes (don't need to do this again if already previewed)
		previewThemeColor(primaryColor);
		
		// Force the context to update with the new theme
		document.documentElement.style.setProperty('--primary-color', primaryColor);
		
		// Use a more efficient rendering approach
		// Wait for next frame to ensure theme is fully updated
		requestAnimationFrame(() => {
			// Apply without reloading the page (force a re-render of theme components)
			window.dispatchEvent(new Event('custom-theme-updated'));
		});
	};
	
	// Function to reset the theme to default
	const resetCustomTheme = () => {
		// Remove custom theme from localStorage
		if (typeof window !== 'undefined') {
			localStorage.removeItem("customThemePrimaryColor");
		}
		
		// Reset to default color
		const defaultColor = "#6A36FC";
		setPrimaryColor(defaultColor);
		
		// Reset custom themes to null - will use default themes
		setCustomLightTheme(null);
		setCustomDarkTheme(null);
		
		// Reset CSS variable
		document.documentElement.style.removeProperty('--primary-color');
		
		// Wait for next frame to ensure theme is fully updated
		requestAnimationFrame(() => {
			// Apply without reloading the page (force a re-render of theme components)
			window.dispatchEvent(new Event('custom-theme-updated'));
		});
	};

	// Cache for generated themes to avoid redundant calculations
	const themeCache = useRef<{[key: string]: {light?: Theme, dark?: Theme}}>({});
	
	// Function to generate and preview themes based on a color with caching
	// Using useCallback to memoize the function and avoid dependency issues
	const previewThemeColor = useCallback((color: string) => {
		// Return immediately if dragging (we'll generate when drag ends)
		if (isDragging) return;
		
		// Check cache first
		if (!themeCache.current[color]) {
			themeCache.current[color] = {};
		}
		
		// Use requestAnimationFrame to batch visual updates efficiently
		requestAnimationFrame(() => {
			// Determine which theme(s) we need based on current mode
			const needsLightTheme = currentTheme === "light" || 
				(currentTheme === "auto" && window.matchMedia('(prefers-color-scheme: light)').matches);
			const needsDarkTheme = currentTheme === "dark" || 
				(currentTheme === "auto" && !window.matchMedia('(prefers-color-scheme: light)').matches);
			
			// Use cached versions if available, generate if not
			if (needsLightTheme) {
				if (!themeCache.current[color].light) {
					// Notify UI that we're computing a theme (could show a spinner)
					console.log("Generating light theme for", color);
					themeCache.current[color].light = getCustomTheme(color, "light");
				}
				setCustomLightTheme(themeCache.current[color].light!);
			}
			
			if (needsDarkTheme) {
				if (!themeCache.current[color].dark) {
					// Notify UI that we're computing a theme (could show a spinner)
					console.log("Generating dark theme for", color);
					themeCache.current[color].dark = getCustomTheme(color, "dark");
				}
				setCustomDarkTheme(themeCache.current[color].dark!);
			}
		});
	}, [isDragging, currentTheme, setCustomLightTheme, setCustomDarkTheme]);
	
	// Now that previewThemeColor is defined, we can use it in useEffect
	useEffect(() => {
		// Handle mouse and touch events to detect active dragging
		const handleMouseUp = () => {
			if (isDragging) {
				setIsDragging(false);
				// Generate preview only after user stops dragging
				previewThemeColor(primaryColor);
			}
		};
		
		window.addEventListener('mouseup', handleMouseUp);
		window.addEventListener('touchend', handleMouseUp);
		
		return () => {
			window.removeEventListener('mouseup', handleMouseUp);
			window.removeEventListener('touchend', handleMouseUp);
		};
	}, [isDragging, primaryColor, previewThemeColor]);

	// Function to set a color from the predefined color palette and apply immediately
	const setPresetColor = (color: string) => {
		// Update color picker value
		setPrimaryColor(color);
		
		// Update the button color immediately (pure CSS, no lag)
		document.documentElement.style.setProperty('--primary-color-preview', color);
		document.getElementById('apply-color-button')?.style.setProperty('background-color', color);
		
		// Use the cached theme if available, generate if not (but with minimal UI blocking)
		setTimeout(() => {
			// Generate themes for preview (will use cache if available)
			previewThemeColor(color);
			
			// Save to localStorage
			saveCustomThemeToLocalStorage(color);
			
			// Force the context to update with the new theme
			document.documentElement.style.setProperty('--primary-color', color);
			
			// Wait for next frame to ensure theme is fully updated
			requestAnimationFrame(() => {
				// Apply without reloading the page (force a re-render of theme components)
				window.dispatchEvent(new Event('custom-theme-updated'));
			});
		}, 0); // Minimal timeout to prevent UI freeze
	};

	// Add mouse events to the preset buttons for better UX
	
	// More aggressive debouncing for previews to improve performance
	const debouncedPreview = (color: string) => {
		// Skip entirely during drag operations
		if (isDragging) return;
		
		// Clear any existing timeout
		if (previewTimeout !== null) {
			window.clearTimeout(previewTimeout);
		}
		
		// Set CSS variable immediately for instant visual feedback
		document.documentElement.style.setProperty('--primary-color-preview', color);
		document.getElementById('apply-color-button')?.style.setProperty('background-color', color);
		
		// Only generate theme if we haven't already cached it
		const needsGeneration = !themeCache.current[color] || 
			(!themeCache.current[color].light && currentTheme === "light") ||
			(!themeCache.current[color].dark && currentTheme === "dark");
			
		// If we need to generate a theme, use a long delay to ensure UI responsiveness
		if (needsGeneration) {
			// Using a very long delay (500ms) prevents UI freeze during quick hover movements
			const timeoutId = window.setTimeout(() => {
				previewThemeColor(color);
			}, 500);
			
			setPreviewTimeout(timeoutId);
		} else {
			// If theme is cached, we can apply it immediately with minimal delay
			const timeoutId = window.setTimeout(() => {
				previewThemeColor(color);
			}, 50);
			
			setPreviewTimeout(timeoutId);
		}
	};
	
	// Mouse handlers for color previews
	const handlePresetMouseEnter = (color: string) => {
		debouncedPreview(color);
	};
	
	const handlePresetMouseLeave = () => {
		// On mouse leave, restore the current selected color's preview
		debouncedPreview(primaryColor);
	};

	// Predefined color palette examples
	const presetColors = [
		'#6A36FC', // Purple
		'#F74B4B', // Red
		'#00A3FF', // Blue
		'#00C853', // Green
		'#FF7A00', // Orange
		'#9C27B0', // Deep Purple
	];

	return (
		<form>
			{Boolean(error) && <ErrorAlert error={error} />}

			<Typography variant="h6" sx={{ mb: 2, mt: 2 }}>Theme Selection</Typography>
			
			<RadioGroup 
				value={currentTheme} 
				onChange={(e) => onChangeTheme(e.target.value)}
				name="theme-selection"
				css={{ marginBottom: '24px' }}
			>
				<div css={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
					<FormControlLabel 
						value="auto"
						control={<Radio />}
						label={
							<AutoThemePreviewButton
								displayName="Auto"
								active={currentTheme === "auto"}
								themes={[themes.dark, themes.light]}
							/>
						}
					/>
					<FormControlLabel
						value="dark"
						control={<Radio />}
						label={
							<ThemePreviewButton
								displayName="Dark"
								active={currentTheme === "dark"}
								theme={customDarkTheme || themes.dark}
							/>
						}
					/>
					<FormControlLabel
						value="light"
						control={<Radio />}
						label={
							<ThemePreviewButton
								displayName="Light"
								active={currentTheme === "light"}
								theme={customLightTheme || themes.light}
							/>
						}
					/>
				</div>
			</RadioGroup>
			
			{/* Custom color picker - always visible */}
			<div css={{ marginTop: 24, marginBottom: 24 }}>
				<Typography variant="h6" sx={{ mb: 2 }}>Customize Theme Colors</Typography>
				
				<FormGroup>
					<Typography variant="body2" sx={{ mb: 2 }}>
						Choose a primary color to customize your selected theme. The system will apply this color to 
						either dark or light mode while maintaining appropriate contrast.
					</Typography>
					
					<Stack direction="row" spacing={2} alignItems="flex-end">
						<TextField
							label="Primary Color"
							type="color"
							value={primaryColor}
							onChange={handleColorChange}
							sx={{ width: 200 }}
						/>
						<Button 
							id="apply-color-button"
							variant="contained" 
							onClick={applyCustomTheme}
							disabled={isUpdating}
							sx={{ 
								backgroundColor: primaryColor,
								'&:hover': {
									backgroundColor: primaryColor + 'dd',
								}
							}}
						>
							Apply Custom Color
						</Button>
						<Button 
							variant="outlined"
							onClick={resetCustomTheme}
							disabled={isUpdating}
						>
							Reset to Default
						</Button>
					</Stack>
					
					<div css={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px' }}>
						<div css={{ 
							display: 'flex', 
							flexDirection: 'column', 
							alignItems: 'flex-start' 
						}}>
							<Typography variant="caption" sx={{ mb: 1 }}>Try these colors:</Typography>
							<div css={{ display: 'flex', gap: '8px' }}>
								{presetColors.map(color => (
									<div 
										key={color}
										css={{ 
											width: 24, 
											height: 24, 
											backgroundColor: color, 
											borderRadius: '50%',
											cursor: 'pointer',
											border: `2px solid ${color === primaryColor ? 'white' : 'transparent'}`,
											boxShadow: color === primaryColor ? '0 0 0 1px #000' : 'none',
											transition: 'transform 0.1s ease-in-out',
											'&:hover': {
												transform: 'scale(1.2)',
											}
										}}
										onClick={() => setPresetColor(color)}
										onMouseEnter={() => handlePresetMouseEnter(color)}
										onMouseLeave={handlePresetMouseLeave}
									/>
								))}
							</div>
						</div>
					</div>
					
					<FormHelperText sx={{ mt: 2 }}>
						The color picker preview updates immediately. Click a preset color or "Apply Custom Color" to save.
						Your custom colors will apply to whichever theme mode you select (Dark/Light/Auto).
					</FormHelperText>
				</FormGroup>
			</div>
		</form>
	);
};

interface AutoThemePreviewButtonProps extends Omit<ThemePreviewProps, "theme"> {
	themes: [Theme, Theme];
	onSelect?: () => void;
}

const AutoThemePreviewButton: FC<AutoThemePreviewButtonProps> = ({
	active,
	preview,
	className,
	displayName,
	themes,
	onSelect,
}) => {
	const [leftTheme, rightTheme] = themes;

	return (
		<div onClick={onSelect} css={{ cursor: 'pointer', marginTop: 16, marginBottom: 16 }}>
			<div css={{ position: 'relative', width: 220, height: 180 }}>
				<div
					css={{
						// This half is absolute to not advance the layout (which would offset the second half)
						position: "absolute",
						// Slightly past the bounding box to avoid cutting off the outline
						clipPath: "polygon(-5% -5%, 50% -5%, 50% 105%, -5% 105%)",
					}}
				>
					<ThemePreview
						active={active}
						preview={preview}
						displayName={displayName}
						theme={leftTheme}
					/>
				</div>
				<ThemePreview
					active={active}
					preview={preview}
					displayName={displayName}
					theme={rightTheme}
				/>
			</div>
		</div>
	);
};

interface ThemePreviewButtonProps extends ThemePreviewProps {
	onSelect?: () => void;
}

const ThemePreviewButton: FC<ThemePreviewButtonProps> = ({
	active,
	preview,
	className,
	displayName,
	theme,
	onSelect,
}) => {
	return (
		<div onClick={onSelect} css={{ cursor: 'pointer', marginTop: 16, marginBottom: 16 }}>
			<ThemePreview
				active={active}
				preview={preview}
				displayName={displayName}
				theme={theme}
			/>
		</div>
	);
};

interface ThemePreviewProps {
	active?: boolean;
	preview?: boolean;
	className?: string;
	displayName: string;
	theme: Theme;
}

const ThemePreview: FC<ThemePreviewProps> = ({
	active,
	preview,
	className,
	displayName,
	theme,
}) => {
	return (
		<ThemeOverride theme={theme}>
			<div
				css={[styles.container, active && styles.containerActive]}
				className={className}
			>
				<div css={styles.page}>
					<div css={styles.header}>
						<div css={styles.headerLinks}>
							<div css={[styles.headerLink, styles.activeHeaderLink]} />
							<div css={styles.headerLink} />
							<div css={styles.headerLink} />
						</div>
						<div css={styles.headerLinks}>
							<div css={styles.proxy} />
							<div css={styles.user} />
						</div>
					</div>
					<div css={styles.body}>
						<div css={styles.title} />
						<div css={styles.table}>
							<div css={styles.tableHeader} />
							<div css={styles.workspace} />
							<div css={styles.workspace} />
							<div css={styles.workspace} />
							<div css={styles.workspace} />
						</div>
					</div>
				</div>
				<div css={styles.label}>
					<span>{displayName}</span>
					{preview && <PreviewBadge />}
				</div>
			</div>
		</ThemeOverride>
	);
};

const styles = {
	container: (theme) => ({
		backgroundColor: theme.palette.background.default,
		border: `1px solid ${theme.palette.divider}`,
		width: 220,
		color: theme.palette.text.primary,
		borderRadius: 6,
		overflow: "clip",
		userSelect: "none",
	}),
	containerActive: (theme) => ({
		outline: `2px solid ${theme.roles.active.outline}`,
	}),
	page: (theme) => ({
		backgroundColor: theme.palette.background.default,
		color: theme.palette.text.primary,
	}),
	header: (theme) => ({
		backgroundColor: theme.palette.background.paper,
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "6px 10px",
		marginBottom: 8,
		borderBottom: `1px solid ${theme.palette.divider}`,
	}),
	headerLinks: {
		display: "flex",
		alignItems: "center",
		gap: 6,
	},
	headerLink: (theme) => ({
		backgroundColor: theme.palette.text.secondary,
		height: 6,
		width: 20,
		borderRadius: 3,
	}),
	activeHeaderLink: (theme) => ({
		backgroundColor: theme.palette.text.primary,
	}),
	proxy: (theme) => ({
		backgroundColor: theme.palette.success.light,
		height: 6,
		width: 12,
		borderRadius: 3,
	}),
	user: (theme) => ({
		backgroundColor: theme.palette.text.primary,
		height: 8,
		width: 8,
		borderRadius: 4,
		float: "right",
	}),
	body: {
		width: 120,
		margin: "auto",
	},
	title: (theme) => ({
		backgroundColor: theme.palette.text.primary,
		height: 8,
		width: 45,
		borderRadius: 4,
		marginBottom: 6,
	}),
	table: (theme) => ({
		border: `1px solid ${theme.palette.divider}`,
		borderBottom: "none",
		borderTopLeftRadius: 3,
		borderTopRightRadius: 3,
		overflow: "clip",
	}),
	tableHeader: (theme) => ({
		backgroundColor: theme.palette.background.paper,
		height: 10,
		margin: -1,
	}),
	label: (theme) => ({
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		borderTop: `1px solid ${theme.palette.divider}`,
		padding: "4px 12px",
		fontSize: 14,
	}),
	workspace: (theme) => ({
		borderTop: `1px solid ${theme.palette.divider}`,
		height: 15,

		"&::after": {
			content: '""',
			display: "block",
			marginTop: 4,
			marginLeft: 4,
			backgroundColor: theme.palette.text.disabled,
			height: 6,
			width: 30,
			borderRadius: 3,
		},
	}),
} satisfies Record<string, Interpolation<Theme>>;