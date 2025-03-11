import type { NewTheme } from "../experimental";
import tw from "../tailwindColors";

// Using the dark experimental theme as a basis but with purple colors
const experimental: NewTheme = {
	l1: {
		background: tw.purple[950],
		outline: tw.purple[700],
		text: tw.white,
		fill: {
			solid: tw.purple[600],
			outline: tw.purple[600],
			text: tw.white,
		},
	},

	l2: {
		background: tw.purple[900],
		outline: tw.purple[700],
		text: tw.zinc[50],
		fill: {
			solid: tw.purple[500],
			outline: tw.purple[500],
			text: tw.white,
		},
		disabled: {
			background: tw.purple[900],
			outline: tw.purple[700],
			text: tw.zinc[200],
			fill: {
				solid: tw.purple[500],
				outline: tw.purple[500],
				text: tw.white,
			},
		},
		hover: {
			background: tw.purple[600],
			outline: tw.purple[500],
			text: tw.white,
			fill: {
				solid: tw.purple[400],
				outline: tw.purple[400],
				text: tw.white,
			},
		},
	},

	pillDefault: {
		background: tw.purple[800],
		outline: tw.purple[700],
		text: tw.white,
	},
};

export default experimental;