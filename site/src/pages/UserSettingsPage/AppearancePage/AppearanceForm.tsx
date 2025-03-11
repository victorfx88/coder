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
import { type FC, useState, useEffect } from "react";
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

	// Debounce the theme generation to improve performance when dragging the color picker
	const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newColor = e.target.value;
		setPrimaryColor(newColor);
		
		// Use debounced preview to avoid lag when dragging the color picker
		debouncedPreview(newColor);
		
		// Update primary color CSS var for immediate visual feedback
		document.documentElement.style.setProperty('--primary-color-preview', newColor);
	};

	const applyCustomTheme = () => {
		// Save the custom color to localStorage
		saveCustomThemeToLocalStorage(primaryColor);
		
		// Generate themes for preview
		previewThemeColor(primaryColor);
		
		// Force the context to update with the new theme
		document.documentElement.style.setProperty('--primary-color', primaryColor);
		
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

	// Function to generate and preview themes based on a color
	const previewThemeColor = (color: string) => {
		// Generate themes with this color
		const lightTheme = getCustomTheme(color, "light");
		const darkTheme = getCustomTheme(color, "dark");
		
		// Update theme previews
		setCustomLightTheme(lightTheme);
		setCustomDarkTheme(darkTheme);
	};

	// Function to set a color from the predefined color palette and apply immediately
	const setPresetColor = (color: string) => {
		// Update color picker value
		setPrimaryColor(color);
		
		// Generate themes for preview
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
	};

	// Add mouse events to the preset buttons for better UX
	const [previewTimeout, setPreviewTimeout] = useState<number | null>(null);
	
	// Preview a color, but debounced to avoid performance issues
	const debouncedPreview = (color: string) => {
		// Clear any existing timeout
		if (previewTimeout !== null) {
			window.clearTimeout(previewTimeout);
		}
		
		// Set a new timeout to generate themes after a short delay
		const timeoutId = window.setTimeout(() => {
			previewThemeColor(color);
		}, 100); // 100ms delay is enough to feel responsive but not bog down during drag
		
		setPreviewTimeout(timeoutId);
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