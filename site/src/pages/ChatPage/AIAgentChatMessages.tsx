import { type FC, useEffect, useRef, memo, useState } from "react";
import { useTheme } from "@emotion/react";
import { useAIAgentChat } from "../../hooks/useAIAgentChat";
import { ErrorAlert } from "components/Alert/ErrorAlert";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import Paper from "@mui/material/Paper";
import type { Message } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { keyframes } from "@emotion/react";
import ButtonGroup from "@mui/material/ButtonGroup";
import Button from "@mui/material/Button";
import type { AIAgent } from "api/typesGenerated";

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// Animation for the typing indicator dots
const typingAnimation = keyframes`
  0%, 20% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
`;

interface MessageBubbleProps {
	message: Message;
}

// Typing indicator component that shows animated dots
const TypingIndicator: FC = () => {
	const theme = useTheme();

	return (
		<div
			css={{
				display: "flex",
				justifyContent: "flex-start",
				maxWidth: "100%",
				animation: `${fadeIn} 0.3s ease-out`,
				overflowX: "auto",
			}}
		>
			<Paper
				elevation={0}
				variant="outlined"
				css={{
					padding: theme.spacing(1.25, 1.75),
					fontSize: "0.85rem",
					lineHeight: 1.5,
					backgroundColor: theme.palette.background.paper,
					borderColor: theme.palette.divider,
					color: theme.palette.text.primary,
					borderRadius: "16px",
					borderBottomLeftRadius: "4px",
					// Set a fixed width CSS property using ch unit for consistency with agent messages
					width: "83ch",
					fontFamily: "'Menlo', 'Consolas', 'Monaco', 'Courier New', monospace",
				}}
			>
				<div css={{ display: "flex", alignItems: "center" }}>
					<span>Thinking</span>
					<span
						css={{
							display: "inline-block",
							marginLeft: "4px",
							"& > span": {
								display: "inline-block",
								width: "4px",
								height: "4px",
								borderRadius: "50%",
								backgroundColor: theme.palette.text.primary,
								margin: "0 2px",
							},
						}}
					>
						<span
							css={{ animation: `${typingAnimation} 1.4s infinite 0.0s` }}
						/>
						<span
							css={{ animation: `${typingAnimation} 1.4s infinite 0.2s` }}
						/>
						<span
							css={{ animation: `${typingAnimation} 1.4s infinite 0.4s` }}
						/>
					</span>
				</div>
			</Paper>
		</div>
	);
};

const MessageBubble: FC<MessageBubbleProps> = memo(({ message }) => {
	const theme = useTheme();
	const isUser = message.role === "user";

	return (
		<div
			css={{
				display: "flex",
				justifyContent: isUser ? "flex-end" : "flex-start",
				maxWidth: isUser ? "80%" : "100%", // Allow full width for agent messages
				marginLeft: isUser ? "auto" : 0,
				animation: `${fadeIn} 0.3s ease-out`,
				overflowX: !isUser ? "auto" : "visible", // Add horizontal scrolling for agent messages
			}}
		>
			<Paper
				elevation={isUser ? 1 : 0}
				variant={isUser ? "elevation" : "outlined"}
				css={{
					padding: theme.spacing(1.25, 1.75),
					fontSize: "0.925rem",
					lineHeight: 1.5,
					backgroundColor: isUser
						? theme.palette.grey[900]
						: theme.palette.background.paper,
					borderColor: !isUser ? theme.palette.divider : undefined,
					color: isUser ? theme.palette.grey[50] : theme.palette.text.primary,
					borderRadius: "16px",
					borderBottomRightRadius: isUser ? "4px" : "16px",
					borderBottomLeftRadius: isUser ? "16px" : "4px",
					width: "auto",
					maxWidth: "100%",
					fontFamily: !isUser
						? "'Menlo', 'Consolas', 'Monaco', 'Courier New', monospace"
						: "inherit",
					whiteSpace: !isUser ? "pre-wrap" : "normal",
					"& img": {
						maxWidth: "100%",
						maxHeight: "400px",
						height: "auto",
						borderRadius: "8px",
						marginTop: theme.spacing(1),
						marginBottom: theme.spacing(1),
					},
					"& p": {
						margin: theme.spacing(1, 0),
						"&:first-of-type": {
							marginTop: 0,
						},
						"&:last-of-type": {
							marginBottom: 0,
						},
					},
					"& ul, & ol": {
						margin: theme.spacing(1.5, 0),
						paddingLeft: theme.spacing(3),
					},
					"& li": {
						margin: theme.spacing(0.5, 0),
					},
					"& code:not(pre > code)": {
						backgroundColor: isUser
							? theme.palette.grey[700]
							: theme.palette.action.hover,
						color: isUser ? theme.palette.grey[50] : theme.palette.text.primary,
						padding: theme.spacing(0.25, 0.75),
						borderRadius: "4px",
						fontSize: "0.875em",
						fontFamily: "monospace",
					},
					"& pre": {
						backgroundColor: isUser
							? theme.palette.common.black
							: theme.palette.grey[100],
						color: isUser
							? theme.palette.grey[100]
							: theme.palette.text.primary,
						padding: theme.spacing(1.5),
						borderRadius: "8px",
						overflowX: "auto",
						margin: theme.spacing(1.5, 0),
						width: "100%",
						"& code": {
							backgroundColor: "transparent",
							padding: 0,
							fontSize: "0.875em",
							fontFamily: "monospace",
							color: "inherit",
						},
					},
					"& a": {
						color: isUser
							? theme.palette.grey[100]
							: theme.palette.primary.main,
						textDecoration: "underline",
						fontWeight: 500,
						"&:hover": {
							textDecoration: "none",
							color: isUser
								? theme.palette.grey[300]
								: theme.palette.primary.dark,
						},
					},
				}}
			>
				{message.role === "assistant" && message.parts ? (
					<div>
						{message.parts.map((part, partIndex) => {
							switch (part.type) {
								case "text":
									return (
										<ReactMarkdown
											key={partIndex}
											remarkPlugins={[remarkGfm]}
											rehypePlugins={[rehypeRaw]}
											css={{
												"& pre": {
													backgroundColor: theme.palette.background.default,
												},
											}}
										>
											{part.text}
										</ReactMarkdown>
									);
								default:
									return null;
							}
						})}
					</div>
				) : message.role === "assistant" ? (
					// Agent messages are displayed as pre-formatted text to preserve 80-char width
					<div
						css={{
							overflowX: "auto",
							fontFamily:
								"'Menlo', 'Consolas', 'Monaco', 'Courier New', monospace",
							backgroundColor: theme.palette.action.hover,
							borderRadius: "4px",
							padding: theme.spacing(1),
							margin: theme.spacing(0.5, 0),
							fontSize: "0.85rem",
							// Set a fixed width CSS property using ch unit (character width)
							// The ch unit is approximately the width of the "0" character in the current font
							// Using a value slightly larger than 80 to account for padding and ensure all characters fit
							width: "83ch", // A bit more than 80ch to ensure 80 characters fit perfectly
						}}
					>
						{message.content}
					</div>
				) : (
					// User messages use markdown rendering
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						rehypePlugins={[rehypeRaw]}
					>
						{message.content}
					</ReactMarkdown>
				)}
			</Paper>
		</div>
	);
});

interface AIAgentChatMessagesProps {
	selectedAgent: AIAgent;
}

export const AIAgentChatMessages: FC<AIAgentChatMessagesProps> = ({
	selectedAgent,
}) => {
	const {
		messages,
		input,
		inputMode,
		setInputMode,
		sentChars,
		textareaRef,
		handleInputChange,
		handleSubmit,
		handleKeyDown: handleRawKeyDown,
		isLoading,
		error,
	} = useAIAgentChat({ agent: selectedAgent });

	const theme = useTheme();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const controlAreaRef = useRef<HTMLDivElement>(null);
	const [controlAreaFocused, setControlAreaFocused] = useState(false);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		const timer = setTimeout(() => {
			messagesEndRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "end",
			});
		}, 50);
		return () => clearTimeout(timer);
	}, [messages, isLoading]);

	// Focus appropriate input area when component mounts or mode changes
	useEffect(() => {
		if (inputMode === "text") {
			textareaRef.current?.focus();
		} else {
			controlAreaRef.current?.focus();
			setControlAreaFocused(true);
		}
	}, [inputMode]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (inputMode === "control") {
			handleRawKeyDown(event);
		} else if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	};

	if (error) {
		return <ErrorAlert error={error} />;
	}

	return (
		<div
			css={{
				display: "flex",
				flexDirection: "column",
				height: "100%",
				backgroundColor: theme.palette.background.default,
			}}
		>
			<div
				css={{
					flexGrow: 1,
					overflowY: "auto",
					padding: theme.spacing(3),
				}}
			>
				<div
					css={{
						maxWidth: "900px",
						width: "100%",
						margin: "0 auto",
						display: "flex",
						flexDirection: "column",
						gap: theme.spacing(3),
					}}
				>
					{messages.map((message, index) => (
						<MessageBubble key={`message-${index}`} message={message} />
					))}
					{isLoading && <TypingIndicator />}
					<div ref={messagesEndRef} />
				</div>
			</div>

			<div
				css={{
					width: "100%",
					maxWidth: "900px",
					margin: "0 auto",
					padding: theme.spacing(2, 3, 2, 3),
					backgroundColor: theme.palette.background.default,
					borderTop: `1px solid ${theme.palette.divider}`,
					flexShrink: 0,
				}}
			>
				<div css={{ marginBottom: theme.spacing(1.5) }}>
					<ButtonGroup fullWidth variant="outlined" size="small">
						<Button
							onClick={() => setInputMode("text")}
							variant={inputMode === "text" ? "contained" : "outlined"}
						>
							Text Mode
						</Button>
						<Button
							onClick={() => setInputMode("control")}
							variant={inputMode === "control" ? "contained" : "outlined"}
						>
							Control Mode
						</Button>
					</ButtonGroup>
				</div>

				{inputMode === "text" ? (
					<Paper
						component="form"
						onSubmit={handleSubmit}
						elevation={0}
						variant="outlined"
						css={{
							padding: theme.spacing(0.5, 0.5, 0.5, 1.5),
							display: "flex",
							alignItems: "flex-start",
							width: "100%",
							borderRadius: "12px",
							backgroundColor: theme.palette.background.paper,
							transition: "border-color 0.2s ease",
							"&:focus-within": {
								borderColor: theme.palette.primary.main,
							},
						}}
					>
						<TextField
							inputRef={textareaRef}
							value={input}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							placeholder="Message AI Agent..."
							fullWidth
							variant="standard"
							multiline
							maxRows={5}
							InputProps={{ disableUnderline: true }}
							css={{
								alignSelf: "center",
								padding: theme.spacing(0.75, 0),
								fontSize: "0.9rem",
							}}
							autoFocus
						/>
						<IconButton
							type="submit"
							color="primary"
							disabled={!input.trim() || isLoading}
							css={{
								alignSelf: "flex-end",
								marginBottom: theme.spacing(0.5),
								transition: "transform 0.2s ease, background-color 0.2s ease",
								"&:not(:disabled):hover": {
									transform: "scale(1.1)",
									backgroundColor: theme.palette.action.hover,
								},
							}}
						>
							<SendIcon />
						</IconButton>
					</Paper>
				) : (
					<Paper
						elevation={0}
						variant="outlined"
						css={{
							padding: theme.spacing(1.5),
							width: "100%",
							borderRadius: "12px",
							backgroundColor: theme.palette.background.paper,
							transition: "border-color 0.2s ease",
							"&:focus-within": {
								borderColor: theme.palette.primary.main,
							},
							minHeight: "60px",
							cursor: "text",
							fontFamily:
								"'Menlo', 'Consolas', 'Monaco', 'Courier New', monospace",
							fontSize: "0.9rem",
							position: "relative",
						}}
						onClick={() => {
							controlAreaRef.current?.focus();
							setControlAreaFocused(true);
						}}
					>
						<div
							ref={controlAreaRef}
							tabIndex={0}
							onFocus={() => setControlAreaFocused(true)}
							onBlur={() => setControlAreaFocused(false)}
							onKeyDown={handleKeyDown}
							css={{
								outline: "none",
								width: "100%",
								height: "100%",
								position: "absolute",
								top: 0,
								left: 0,
								padding: theme.spacing(1.5),
							}}
						/>

						<div
							css={{
								display: "flex",
								flexWrap: "wrap",
								gap: theme.spacing(0.75),
							}}
						>
							{sentChars.map((char) => (
								<div
									key={char.id}
									css={{
										backgroundColor: theme.palette.action.selected,
										color: theme.palette.text.primary,
										borderRadius: "4px",
										padding: theme.spacing(0.25, 0.5),
										fontSize: "0.85rem",
										fontFamily: "monospace",
										animation: `${fadeIn} 0.2s ease-out forwards`,
									}}
								>
									{char.char}
								</div>
							))}
							{controlAreaFocused && (
								<div
									css={{
										width: "8px",
										height: "16px",
										backgroundColor: theme.palette.primary.main,
										borderRadius: "1px",
										animation: `${typingAnimation} 1s infinite`,
									}}
								/>
							)}
						</div>

						{sentChars.length === 0 && !controlAreaFocused && (
							<div
								css={{
									color: theme.palette.text.secondary,
									fontStyle: "italic",
								}}
							>
								Click to interact with terminal...
							</div>
						)}
					</Paper>
				)}
			</div>
		</div>
	);
};

export default AIAgentChatMessages;
