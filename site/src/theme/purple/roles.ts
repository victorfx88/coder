import type { Roles } from "../roles";
import colors from "../tailwindColors";
import darkRoles from "../dark/roles";

// Create a purple theme by extending the dark theme roles
// This maintains consistency with dark theme and reduces duplication
const roles: Roles = {
	// Reuse all common role definitions from dark theme
	...darkRoles,
	
	// Override only the roles that need purple styling
	info: {
		background: colors.purple[950],
		outline: colors.purple[400],
		text: colors.purple[50],
		fill: {
			solid: colors.purple[500],
			outline: colors.purple[600],
			text: colors.white,
		},
	},
	active: {
		background: colors.purple[950],
		outline: colors.purple[500],
		text: colors.purple[50],
		fill: {
			solid: colors.purple[600],
			outline: colors.purple[400],
			text: colors.white,
		},
		disabled: {
			background: colors.purple[950],
			outline: colors.purple[800],
			text: colors.purple[200],
			fill: {
				solid: colors.purple[800],
				outline: colors.purple[800],
				text: colors.white,
			},
		},
		hover: {
			background: colors.purple[900],
			outline: colors.purple[500],
			text: colors.white,
			fill: {
				solid: colors.purple[500],
				outline: colors.purple[500],
				text: colors.white,
			},
		},
	},
};

export default roles;