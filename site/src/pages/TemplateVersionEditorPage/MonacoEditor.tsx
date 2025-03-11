import { useTheme } from "@emotion/react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { type FC, useEffect } from "react";
import { MONOSPACE_FONT_FAMILY } from "theme/constants";

loader.config({ monaco });

export interface MonacoEditorProps {
	value?: string;
	path?: string;
	onChange?: (value: string) => void;
}

export const MonacoEditor: FC<MonacoEditorProps> = ({
	onChange,
	value,
	path,
}) => {
	const theme = useTheme();

	useEffect(() => {
		document.fonts.ready
			.then(() => {
				// Ensures that all text is measured properly.
				// If this isn't done, there can be weird selection issues.
				monaco.editor.remeasureFonts();
			})
			.catch(() => {
				// Not a biggie\!
			});

		// Check if theme has monaco property to avoid errors
		if (theme && theme.monaco) {
			try {
				// Make a defensive copy of the theme to avoid potential crashes
				const safeTheme = { ...theme.monaco };
				
				// Fix for purple theme - ensure colors are safe values
				if (safeTheme.colors && safeTheme.colors["editor.foreground"] === "#fff") {
					safeTheme.colors["editor.foreground"] = "#eeeeee";
				}
				
				monaco.editor.defineTheme("min", safeTheme);
			} catch (error) {
				console.error("Error defining Monaco theme:", error);
			}
		}
	}, [theme]);

	return (
		<Editor
			value={value}
			theme="min"
			options={{
				automaticLayout: true,
				fontFamily: MONOSPACE_FONT_FAMILY,
				fontSize: 14,
				minimap: {
					enabled: false,
				},
			}}
			path={path}
			onChange={(value) => {
				if (onChange && value) {
					onChange(value);
				}
			}}
		/>
	);
};