import type * as monaco from "monaco-editor";
import muiTheme from "./mui";

export default {
	base: "vs-dark",
	inherit: true,
	rules: [
		{
			token: "comment",
			foreground: "6B737C",
		},
		{
			token: "type",
			foreground: "C4A7F5", // Lighter purple for types
		},
		{
			token: "string",
			foreground: "9DB1C5",
		},
		{
			token: "variable",
			foreground: "DDDDDD",
		},
		{
			token: "identifier",
			foreground: "C4A7F5", // Lighter purple for identifiers
		},
		{
			token: "delimiter.curly",
			foreground: "EBB325",
		},
	],
	colors: {
		"editor.foreground": "#eeeeee",
		"editor.background": muiTheme.palette.background.paper,
	},
} satisfies monaco.editor.IStandaloneThemeData as monaco.editor.IStandaloneThemeData;