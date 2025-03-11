// biome-ignore lint/nursery/noRestrictedImports: createTheme
import { createTheme } from "@mui/material/styles";
import darkTheme from "../dark/mui";
import tw from "../tailwindColors";

// Create a purple theme based on the dark theme
// This significantly reduces code duplication
const muiTheme = createTheme({
	...darkTheme,
	palette: {
		...darkTheme.palette,
		// Override with purple-specific colors
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
		action: {
			hover: tw.purple[600],
			active: tw.purple[500],
			disabled: tw.purple[700],
			disabledBackground: tw.purple[800],
			selected: tw.purple[600],
		},
		dots: tw.purple[500],
	},
	components: {
		...darkTheme.components,
		// Override only the components that need purple-specific styling
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
	},
});

export default muiTheme;