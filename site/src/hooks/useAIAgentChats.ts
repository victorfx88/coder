import { useQuery } from "react-query";
import { API } from "../api/api";

export const useAIAgentChats = () => {
  return useQuery(
    ["ai-agent-chats"],
    () => API.listAIAgentChats(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );
};