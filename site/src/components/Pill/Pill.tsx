import type { Interpolation, Theme } from "@emotion/react";
import CircularProgress, {
	type CircularProgressProps,
} from "@mui/material/CircularProgress";
import {
	type FC,
	type HTMLAttributes,
	type ReactNode,
	forwardRef,
	useMemo,
} from "react";
import type { ThemeRole } from "theme/roles";

type PillProps = HTMLAttributes<HTMLDivElement> & {
	icon?: ReactNode;
	type?: ThemeRole;
	size?: "md" | "lg";
};

const themeStyles = (type: ThemeRole) => (theme: Theme) => {
	const palette = theme.roles[type];
	return {
		backgroundColor: palette.background,
		borderColor: palette.outline,
	};
};

const PILL_HEIGHT = 24;
const PILL_ICON_SIZE = 14;
const PILL_ICON_SPACING = (PILL_HEIGHT - PILL_ICON_SIZE) / 2;

export const Pill: FC<PillProps> = forwardRef<HTMLDivElement, PillProps>(
	(props, ref) => {
		const {
			icon,
			type = "inactive",
			children,
			size = "md",
			...divProps
		} = props;
		const typeStyles = useMemo(() => themeStyles(type), [type]);

		return (
			<div
				ref={ref}
				css={[
					styles.pill,
					icon && size === "md" && styles.pillWithIcon,
					size === "lg" && styles.pillLg,
					icon && size === "lg" && styles.pillLgWithIcon,
					typeStyles,
				]}
				{...divProps}
			>
				{icon}
				{children}
			</div>
		);
	},
);

export const PillSpinner: FC<CircularProgressProps> = (props) => {
	return (
		<CircularProgress size={PILL_ICON_SIZE} css={styles.spinner} {...props} />
	);
};

const styles = {
	pill: (theme) => ({
		fontSize: 12,
		color: theme.experimental.l1.text,
		cursor: "default",
		display: "inline-flex",
		alignItems: "center",
		whiteSpace: "nowrap",
		fontWeight: 400,
		borderWidth: 1,
		borderStyle: "solid",
		borderRadius: 99999,
		lineHeight: 1,
		height: PILL_HEIGHT,
		gap: PILL_ICON_SPACING,
		paddingLeft: 12,
		paddingRight: 12,

		"& svg": {
			width: PILL_ICON_SIZE,
			height: PILL_ICON_SIZE,
		},
	}),

	pillWithIcon: {
		paddingLeft: PILL_ICON_SPACING,
	},

	pillLg: {
		gap: PILL_ICON_SPACING * 2,
		padding: "14px 16px",
	},

	pillLgWithIcon: {
		paddingLeft: PILL_ICON_SPACING * 2,
	},

	spinner: (theme) => ({
		color: theme.experimental.l1.text,
		// It is necessary to align it with the MUI Icons internal padding
		"& svg": {
			transform: "scale(.75)",
		},
	}),
} satisfies Record<string, Interpolation<Theme>>;
