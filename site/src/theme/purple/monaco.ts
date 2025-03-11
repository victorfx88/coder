import type * as monaco from "monaco-editor";
import darkMonaco from "../dark/monaco";
import muiTheme from "./mui";

// Create a purple monaco theme based on dark monaco theme
const purpleMonacoTheme: monaco.editor.IStandaloneThemeData = {
	...darkMonaco,
	// Override only the rules that need purple styling
	rules: darkMonaco.rules.map(rule => {
		// Apply purple colors to type and identifier tokens
		if (rule.token === "type" || rule.token === "identifier") {
			return {
				...rule,
				foreground: "C4A7F5" // Lighter purple for types and identifiers
			};
		}
		return rule;
	}),
	colors: {
		...darkMonaco.colors,
		"editor.foreground": muiTheme.palette.text.primary,
		"editor.background": muiTheme.palette.background.paper,
	}
};

export default purpleMonacoTheme;