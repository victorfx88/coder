import tw from "../tailwindColors";
import type { Branding } from "../branding";
import darkBranding from "../dark/branding";

// Create purple branding by extending dark branding
const branding: Branding = {
	// Start with dark branding
	...darkBranding,
	
	// Override with purple-specific branding
	enterprise: {
		background: tw.purple[800],
		divider: tw.purple[600],
		border: tw.purple[600],
		text: tw.white,
	},
	premium: {
		background: tw.purple[700],
		divider: tw.purple[500],
		border: tw.purple[500],
		text: tw.white,
	},
	featureStage: {
		background: tw.purple[800],
		divider: tw.purple[700],
		border: tw.purple[600],
		text: tw.white,
		hover: {
			background: tw.purple[700],
			divider: tw.purple[600],
			border: tw.purple[500],
			text: tw.white,
		},
	},
};

export default branding;