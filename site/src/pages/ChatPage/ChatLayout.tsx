import {
	createContext,
	type FC,
	type PropsWithChildren,
	useContext,
	useEffect,
	useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link, Outlet, useNavigate, useParams, useLocation } from "react-router-dom";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useTheme } from "@emotion/react";
import { createChat, getChats } from "api/queries/chats";
import { deploymentLanguageModels } from "api/queries/deployment";
import { Chat, type LanguageModelConfig } from "api/typesGenerated";
import { ErrorAlert } from "components/Alert/ErrorAlert";
import { Loader } from "components/Loader/Loader";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ChatIcon from "@mui/icons-material/Chat";
import { AIAgentChatMessages } from "./AIAgentChatMessages";

export interface ChatContext {
	selectedModel: string;
	modelConfig: LanguageModelConfig;

	setSelectedModel: (model: string) => void;
}

export const useChatContext = (): ChatContext => {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error("useChatContext must be used within a ChatProvider");
	}
	return context;
};

export const ChatContext = createContext<ChatContext | undefined>(undefined);

const SELECTED_MODEL_KEY = "coder_chat_selected_model";

export const ChatProvider: FC<PropsWithChildren> = ({ children }) => {
	const [selectedModel, setSelectedModel] = useState<string>(() => {
		const savedModel = localStorage.getItem(SELECTED_MODEL_KEY);
		return savedModel || "";
	});
	const modelConfigQuery = useQuery(deploymentLanguageModels());
	useEffect(() => {
		if (!modelConfigQuery.data) {
			return;
		}
		if (selectedModel === "") {
			const firstModel = modelConfigQuery.data.models[0]?.id; // Handle empty models array
			if (firstModel) {
				setSelectedModel(firstModel);
				localStorage.setItem(SELECTED_MODEL_KEY, firstModel);
			}
		}
	}, [modelConfigQuery.data, selectedModel]);

	if (modelConfigQuery.error) {
		return <ErrorAlert error={modelConfigQuery.error} />;
	}

	if (!modelConfigQuery.data) {
		return <Loader fullscreen />;
	}

	const handleSetSelectedModel = (model: string) => {
		setSelectedModel(model);
		localStorage.setItem(SELECTED_MODEL_KEY, model);
	};

	return (
		<ChatContext.Provider
			value={{
				selectedModel,
				modelConfig: modelConfigQuery.data,
				setSelectedModel: handleSetSelectedModel,
			}}
		>
			{children}
		</ChatContext.Provider>
	);
};

export const ChatLayout: FC = () => {
	const queryClient = useQueryClient();
	const { data: chats, isLoading: chatsLoading } = useQuery(getChats());
	const createChatMutation = useMutation(createChat(queryClient));
	const theme = useTheme();
	const navigate = useNavigate();
	const location = useLocation();
	const { chatID } = useParams<{ chatID?: string }>();
	
	// Check if we're on the AI Agent Chat route
	const isAIAgentChat = location.pathname.includes('/chat/ai-agent');
	
	const [tabValue, setTabValue] = useState<string>(isAIAgentChat ? "ai-agent" : "chats");

	useEffect(() => {
		// Update tab value when location changes
		setTabValue(location.pathname.includes('/chat/ai-agent') ? "ai-agent" : "chats");
	}, [location.pathname]);

	const handleNewChat = () => {
		navigate("/chat");
	};

	const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
		setTabValue(newValue);
		if (newValue === "ai-agent") {
			navigate("/chat/ai-agent");
		} else {
			navigate("/chat");
		}
	};

	return (
		// Outermost container: controls height and prevents page scroll
		<div
			css={{
				display: "flex",
				height: "calc(100vh - 164px)", // Assuming header height is 64px
				overflow: "hidden",
			}}
		>
			{/* Sidebar Container (using Paper for background/border) */}
			<Paper
				elevation={1}
				square // Removes border-radius
				css={{
					width: 260,
					flexShrink: 0,
					borderRight: `1px solid ${theme.palette.divider}`,
					display: "flex",
					flexDirection: "column",
					height: "100%", // Take full height of the parent flex container
					backgroundColor: theme.palette.background.paper,
				}}
			>
				{/* Tabs at the top of sidebar */}
				<Tabs
					value={tabValue}
					onChange={handleTabChange}
					variant="fullWidth"
					indicatorColor="primary"
					textColor="primary"
					css={{
						borderBottom: `1px solid ${theme.palette.divider}`,
					}}
				>
					<Tab 
						value="chats" 
						label="Chats" 
						icon={<ChatIcon />} 
						iconPosition="start" 
					/>
					<Tab 
						value="ai-agent" 
						label="AI Agent" 
						icon={<SmartToyIcon />} 
						iconPosition="start" 
					/>
				</Tabs>

				{/* Conditional content based on selected tab */}
				{tabValue === "chats" && (
					<>
						{/* Sidebar Header */}
						<div
							css={{
								padding: theme.spacing(1.5, 2),
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								borderBottom: `1px solid ${theme.palette.divider}`,
								flexShrink: 0,
							}}
						>
							{/* Replaced Typography with div + styling */}
							<div
								css={{
									fontWeight: 600,
									fontSize: theme.typography.subtitle1.fontSize,
									lineHeight: theme.typography.subtitle1.lineHeight,
								}}
							>
								Chats
							</div>
							<Button
								variant="outlined"
								size="small"
								startIcon={<AddIcon fontSize="small" />}
								onClick={handleNewChat}
								disabled={createChatMutation.isLoading}
								css={{
									lineHeight: 1.5,
									padding: theme.spacing(0.5, 1.5),
								}}
							>
								New Chat
							</Button>
						</div>
						{/* Sidebar Scrollable List Area */}
						<div css={{ overflowY: "auto", flexGrow: 1 }}>
							{chatsLoading ? (
								<Loader />
							) : chats && chats.length > 0 ? (
								<List dense>
									{chats.map((chat) => (
										<ListItem key={chat.id} disablePadding>
											<ListItemButton
												component={Link}
												to={`/chat/${chat.id}`}
												selected={chatID === chat.id}
												css={{
													padding: theme.spacing(1, 2),
												}}
											>
												<ListItemText
													primary={chat.title || `Chat ${chat.id}`}
													primaryTypographyProps={{
														noWrap: true,
														variant: "body2",
														style: { overflow: "hidden", textOverflow: "ellipsis" },
													}}
												/>
											</ListItemButton>
										</ListItem>
									))}
								</List>
							) : (
								// Replaced Typography with div + styling
								<div
									css={{
										padding: theme.spacing(2),
										textAlign: "center",
										fontSize: theme.typography.body2.fontSize,
										color: theme.palette.text.secondary,
									}}
								>
									No chats yet. Start a new one!
								</div>
							)}
						</div>
					</>
				)}

				{tabValue === "ai-agent" && (
					<div css={{ 
						padding: theme.spacing(2),
						flexGrow: 1,
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						alignItems: "center",
						color: theme.palette.text.secondary
					}}>
						<SmartToyIcon fontSize="large" color="primary" 
							css={{ marginBottom: theme.spacing(1) }} />
						<div css={{ textAlign: "center" }}>
							<div css={{ fontWeight: 600, marginBottom: theme.spacing(1) }}>
								AI Agent Chat
							</div>
							<div css={{ fontSize: "0.875rem" }}>
								Chat directly with the AI agent using the experimental agent interface.
							</div>
						</div>
					</div>
				)}
			</Paper>

			{/* Main Content Area Container */}
			<div
				css={{
					flexGrow: 1, // Takes remaining width
					height: "100%", // Takes full height of parent
					overflow: "hidden", // Prevents this container from scrolling
					display: "flex",
					flexDirection: "column", // Stacks ChatProvider/Outlet
					position: "relative", // Context for potential absolute children
					backgroundColor: theme.palette.background.default, // Ensure background consistency
				}}
			>
				<ChatProvider>
					{/* Conditionally render either the AI Agent Chat or the regular Chat */}
					{tabValue === "ai-agent" ? (
						<AIAgentChatMessages />
					) : (
						<Outlet />
					)}
				</ChatProvider>
			</div>
		</div>
	);
};

export default ChatLayout;