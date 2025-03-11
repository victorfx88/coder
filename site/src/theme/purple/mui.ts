// biome-ignore lint/nursery/noRestrictedImports: createTheme
import { createTheme } from "@mui/material/styles";
import { BODY_FONT_FAMILY, borderRadius } from "../constants";
import { components } from "../mui";
import tw from "../tailwindColors";

// Create a simple purple theme based on the dark theme structure
const muiTheme = createTheme({
	palette: {
		mode: "dark", // Using dark mode as the base
		primary: {
			main: tw.purple[500],
			contrastText: tw.white,
			light: tw.purple[400],
			dark: tw.purple[600],
		},
		secondary: {
			main: tw.purple[300],
			contrastText: tw.white,
			dark: tw.purple[400],
		},
		background: {
			default: tw.purple[950],
			paper: tw.purple[900],
		},
		text: {
			primary: tw.white,
			secondary: tw.purple[300],
			disabled: tw.purple[500],
		},
		divider: tw.purple[700],
		warning: {
			light: tw.amber[500],
			main: tw.amber[800],
			dark: tw.amber[950],
		},
		success: {
			main: tw.green[500],
			dark: tw.green[600],
		},
		info: {
			light: tw.blue[400],
			main: tw.blue[600],
			dark: tw.blue[950],
			contrastText: tw.white,
		},
		error: {
			light: tw.red[400],
			main: tw.red[500],
			dark: tw.red[950],
			contrastText: tw.white,
		},
		action: {
			hover: tw.purple[600],
			active: tw.purple[500],
			disabled: tw.purple[700],
			disabledBackground: tw.purple[800],
			selected: tw.purple[600],
		},
		neutral: {
			main: tw.zinc[50],
		},
		dots: tw.purple[500],
	},
	typography: {
		fontFamily: BODY_FONT_FAMILY,
		allVariants: {
			color: tw.white,
		},
		body1: {
			fontSize: "1rem",
			lineHeight: "160%",
		},
		body2: {
			fontSize: "0.875rem",
			lineHeight: "160%",
		},
	},
	shape: {
		borderRadius,
	},
	components: {
		...components,
		MuiMenuItem: {
			styleOverrides: {
				root: {
					"&:hover": {
						backgroundColor: tw.purple[600],
						color: tw.white,
					},
				},
			},
		},
		MuiAppBar: {
			styleOverrides: {
				root: {
					backgroundColor: tw.purple[900],
					color: tw.white,
				},
			},
		},
		MuiButton: {
			styleOverrides: {
				root: ({ theme }) => ({
					textTransform: "none",
					letterSpacing: "normal",
					fontWeight: 500,
				}),
				contained: {
					backgroundColor: tw.purple[600],
					color: tw.white,
					"&:hover": {
						backgroundColor: tw.purple[500],
					},
				},
				containedPrimary: {
					backgroundColor: tw.purple[500],
					color: tw.white,
					"&:hover": {
						backgroundColor: tw.purple[400],
					},
				},
				outlined: {
					borderColor: tw.purple[500],
					color: tw.white,
					"&:hover": {
						borderColor: tw.purple[400],
						backgroundColor: tw.purple[600],
					},
				},
				text: {
					color: tw.purple[300],
					"&:hover": {
						backgroundColor: tw.purple[600],
						color: tw.white,
					},
				},
			},
		},
		MuiTab: {
			styleOverrides: {
				root: {
					color: tw.purple[300],
					"&.Mui-selected": {
						color: tw.white,
					},
				},
			},
		},
		MuiTabs: {
			styleOverrides: {
				indicator: {
					backgroundColor: tw.purple[400],
				},
			},
		},
		MuiChip: {
			styleOverrides: {
				root: {
					"& .MuiChip-label": {
						textTransform: "none",
					},
				},
			},
		},
	},
});

export default muiTheme;