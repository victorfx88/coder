import { type Interpolation, type Theme, css } from "@emotion/react";
import { InlineMarkdown } from "components/Markdown/Markdown";
import type { FC } from "react";
import { readableForegroundColor } from "utils/colors";
import { XIcon } from "@codicons/react";

export interface AnnouncementBannerViewProps {
	message?: string;
	backgroundColor?: string;
	dismissible?: boolean;
	onDismiss?: (message: string) => void;
}

export const AnnouncementBannerView: FC<AnnouncementBannerViewProps> = ({
	message,
	backgroundColor,
	dismissible = false,
	onDismiss,
}) => {
	if (!message || !backgroundColor) {
		return null;
	}

	const handleDismiss = () => {
		if (onDismiss && message) {
			onDismiss(message);
		}
	};

	const foregroundColor = readableForegroundColor(backgroundColor);

	return (
		<div
			css={styles.banner}
			style={{ backgroundColor }}
			className="service-banner"
		>
			<div
				css={styles.wrapper}
				style={{ color: foregroundColor }}
			>
				<InlineMarkdown>{message}</InlineMarkdown>
			</div>
			{dismissible && onDismiss && (
				<button
					css={styles.dismissButton}
					style={{ color: foregroundColor }}
					aria-label="Dismiss banner"
					onClick={handleDismiss}
				>
					<XIcon />
				</button>
			)}
		</div>
	);
};

const styles = {
	banner: css`
    padding: 12px;
    display: flex;
    align-items: center;
    position: relative;
  `,
	wrapper: css`
    margin-right: auto;
    margin-left: auto;
    font-weight: 400;

    & a {
      color: inherit;
    }
  `,
	dismissButton: css`
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    opacity: 0.7;
    transition: opacity 0.15s ease;

    &:hover {
      opacity: 1;
    }
  `,
} satisfies Record<string, Interpolation<Theme>>;
