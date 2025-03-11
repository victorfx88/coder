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

	// Load saved custom theme color if exists
	useEffect(() => {
		const savedColor = getCustomThemeFromLocalStorage();
		if (savedColor) {
			setPrimaryColor(savedColor);
			// Generate custom themes based on the saved color
			const lightTheme = getCustomTheme(savedColor, "light");
			const darkTheme = getCustomTheme(savedColor, "dark");
			setCustomLightTheme(lightTheme);
			setCustomDarkTheme(darkTheme);
		}
	}, []);

	const onChangeTheme = async (theme: string) => {
		if (isUpdating) {
			return;
		}

		await onSubmit({ theme_preference: theme });
	};

	const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newColor = e.target.value;
		setPrimaryColor(newColor);
		
		// Generate custom themes based on the new color
		const lightTheme = getCustomTheme(newColor, "light");
		const darkTheme = getCustomTheme(newColor, "dark");
		setCustomLightTheme(lightTheme);
		setCustomDarkTheme(darkTheme);
	};

	const applyCustomTheme = () => {
		// Save the custom color to localStorage
		saveCustomThemeToLocalStorage(primaryColor);
		
		// Apply custom color to the current theme without requiring page reload
		// This will keep the current dark/light selection
		const updatedLightTheme = getCustomTheme(primaryColor, "light");
		const updatedDarkTheme = getCustomTheme(primaryColor, "dark");
		setCustomLightTheme(updatedLightTheme);
		setCustomDarkTheme(updatedDarkTheme);
		
		// Force refresh the current theme selection to apply changes immediately
		onChangeTheme(currentTheme);
	};
	
	// Function to reset the theme to default
	const resetCustomTheme = () => {
		// Remove custom theme from localStorage
		if (typeof window !== 'undefined') {
			localStorage.removeItem("customThemePrimaryColor");
		}
		
		// Reset to default color
		setPrimaryColor("#6A36FC");
		
		// Reset custom themes
		setCustomLightTheme(null);
		setCustomDarkTheme(null);
		
		// Force refresh the current theme selection to apply changes immediately
		onChangeTheme(currentTheme);
	};

	// Function to set a color from the predefined color palette and apply immediately
	const setPresetColor = (color: string) => {
		// Update color picker value
		setPrimaryColor(color);
		
		// Generate and apply themes with this color
		const lightTheme = getCustomTheme(color, "light");
		const darkTheme = getCustomTheme(color, "dark");
		setCustomLightTheme(lightTheme);
		setCustomDarkTheme(darkTheme);
		
		// Save to localStorage
		saveCustomThemeToLocalStorage(color);
		
		// Force refresh the current theme selection to apply changes immediately
		onChangeTheme(currentTheme);
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
										}}
										onClick={() => setPresetColor(color)}
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