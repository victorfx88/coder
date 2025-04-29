import { useState, useEffect, useCallback, useRef } from "react";
import type { ServerSentEvent } from "api/typesGenerated";
import type {
	AIAgentChatClientMessage,
	AIAgentSDKMessageRequestBody,
	AIAgentSDKConversationRole,
} from "api/typesGenerated";
import type { Message } from "@ai-sdk/react";

type ServerSentEventAIAgentData = {
	type: string;
	event: {
		id: number;
		message?: string;
		role?: AIAgentSDKConversationRole;
		time?: string;
		status?: "running" | "stable";
	};
};

type SentChar = {
	char: string;
	id: number;
	timestamp: number;
};

export const useAIAgentChat = () => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const socket = useRef<WebSocket | null>(null);
	const messageIdCounter = useRef(0);
	const [inputMode, setInputMode] = useState<"text" | "control">("text");
	const [sentChars, setSentChars] = useState<SentChar[]>([]);
	const nextCharId = useRef(0);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	// Connect to the websocket endpoint
	useEffect(() => {
		// Note: Using the fixed chat ID from the backend
		const chatID = "a62af7f4-5e48-43a2-a906-bd0763a2926f";
		const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsURL = `${wsProtocol}//${window.location.host}/api/v2/aiagent/chats/${chatID}/watch`;

		socket.current = new WebSocket(wsURL);

		socket.current.onopen = () => {
			console.log("AI Agent chat connection established");
		};

		socket.current.onmessage = (event) => {
			const data = JSON.parse(event.data) as ServerSentEvent;

			if (data.type === "data") {
				const typedData = data.data as ServerSentEventAIAgentData;

				if (typedData.type === "message_update") {
					const messageUpdate = typedData.event;

					setMessages((prevMessages) => {
						// Check if this message already exists (update) or is new
						const existingIndex = prevMessages.findIndex(
							(m) => m.id === messageUpdate.id.toString(),
						);

						if (existingIndex >= 0) {
							// Update existing message
							const updatedMessages = [...prevMessages];
							updatedMessages[existingIndex] = {
								...updatedMessages[existingIndex],
								content: messageUpdate.message || "",
								role: messageUpdate.role === "agent" ? "assistant" : "user",
							};
							if (messageUpdate.role === "user") {
								return updatedMessages.filter((m) => !m.id.startsWith("user-"));
							}
							return updatedMessages;
						} else {
							// Add new message
							return [
								...prevMessages,
								{
									id: messageUpdate.id.toString(),
									content: messageUpdate.message || "",
									role: messageUpdate.role === "agent" ? "assistant" : "user",
									createdAt: new Date(messageUpdate.time || Date.now()),
								},
							];
						}
					});

					setIsLoading(false);
				} else if (typedData.type === "status_change") {
					// Handle status changes if needed
					console.log("Agent status:", typedData.event.status);
				}
			} else if (data.type === "error") {
				setError(
					new Error(
						typeof data.data === "string"
							? data.data
							: JSON.stringify(data.data),
					),
				);
				setIsLoading(false);
			}
		};

		socket.current.onerror = (error) => {
			setError(new Error("WebSocket error"));
			setIsLoading(false);
		};

		socket.current.onclose = () => {
			console.log("AI Agent chat connection closed");
		};

		return () => {
			if (socket.current && socket.current.readyState === WebSocket.OPEN) {
				socket.current.close();
			}
		};
	}, []);

	// Remove sent characters after they expire (2 seconds)
	useEffect(() => {
		if (sentChars.length === 0) return;

		const interval = setInterval(() => {
			const now = Date.now();
			setSentChars((chars) =>
				chars.filter((char) => now - char.timestamp < 2000)
			);
		}, 100);

		return () => clearInterval(interval);
	}, [sentChars]);

	const addSentChar = useCallback((char: string) => {
		const newChar: SentChar = {
			char,
			id: nextCharId.current++,
			timestamp: Date.now(),
		};
		setSentChars((prev) => [...prev, newChar]);
	}, []);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			setInput(e.target.value);
		},
		[],
	);

	const sendMessage = useCallback(
		(content: string, type: "user" | "raw" = "user") => {
			if (
				!socket.current ||
				socket.current.readyState !== WebSocket.OPEN
			)
				return;

			// For user messages, require non-empty content
			if (type === "user" && !content.trim()) return;

			const messageId = messageIdCounter.current++;

			// Only add user messages to UI
			if (type === "user") {
				setMessages((prev) => [
					...prev,
					{
						id: `user-${messageId}`,
						content: content,
						role: "user",
						createdAt: new Date(),
					},
				]);
				setIsLoading(true);
			}

			const messageBody: AIAgentSDKMessageRequestBody = {
				content: content,
				type: type,
			};

			const message: AIAgentChatClientMessage = {
				id: messageId,
				body: messageBody,
			};

			socket.current.send(JSON.stringify(message));
			
			if (type === "user") {
				setInput("");
			}
		},
		[],
	);

	const handleSubmit = useCallback(
		(e?: React.FormEvent<HTMLFormElement>) => {
			if (e) e.preventDefault();
			if (!input.trim()) return;
			
			sendMessage(input, "user");
		},
		[input, sendMessage],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
			// Only process in control mode
			if (inputMode !== "control" || isLoading) return;

			// Map of special keys to their raw escape sequences
			const specialKeys: Record<string, string> = {
				ArrowUp: "\x1b[A",
				ArrowDown: "\x1b[B",
				ArrowRight: "\x1b[C",
				ArrowLeft: "\x1b[D",
				Escape: "\x1b",
				Tab: "\t",
				Delete: "\x1b[3~",
				Home: "\x1b[H",
				End: "\x1b[F",
				PageUp: "\x1b[5~",
				PageDown: "\x1b[6~",
				Backspace: "\b",
			};

			// Check for special keys
			if (specialKeys[e.key]) {
				e.preventDefault();
				addSentChar(e.key);
				sendMessage(specialKeys[e.key], "raw");
				return;
			}

			// Handle Enter as raw newline when in control mode
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				addSentChar("⏎");
				sendMessage("\r", "raw");
				return;
			}

			// Handle Ctrl+key combinations
			if (e.ctrlKey) {
				const ctrlMappings: Record<string, string> = {
					c: "\x03", // Ctrl+C (SIGINT)
					d: "\x04", // Ctrl+D (EOF)
					z: "\x1A", // Ctrl+Z (SIGTSTP)
					l: "\x0C", // Ctrl+L (clear screen)
					a: "\x01", // Ctrl+A (beginning of line)
					e: "\x05", // Ctrl+E (end of line)
					w: "\x17", // Ctrl+W (delete word)
					u: "\x15", // Ctrl+U (clear line)
					r: "\x12", // Ctrl+R (reverse history search)
				};

				if (ctrlMappings[e.key.toLowerCase()]) {
					e.preventDefault();
					addSentChar(`Ctrl+${e.key.toUpperCase()}`);
					sendMessage(ctrlMappings[e.key.toLowerCase()], "raw");
					return;
				}
			}

			// Handle printable characters
			if (e.key.length === 1) {
				e.preventDefault();
				addSentChar(e.key);
				sendMessage(e.key, "raw");
				return;
			}
		},
		[inputMode, isLoading, addSentChar, sendMessage],
	);

	return {
		messages,
		input,
		inputMode,
		setInputMode,
		sentChars,
		textareaRef,
		handleInputChange,
		handleSubmit,
		handleKeyDown,
		isLoading,
		error,
		sendMessage,
	};
};
