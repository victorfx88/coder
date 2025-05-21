import { useState, useCallback, useEffect } from "react";

// Create a key for localStorage
const SIDEBAR_STATE_KEY = "chat-sidebar-state";

export const useChatSidebar = (defaultOpen = true) => {
  // Try to get the saved state from localStorage, otherwise use the default
  const getSavedState = () => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
      return saved ? JSON.parse(saved) : defaultOpen;
    } catch (e) {
      return defaultOpen;
    }
  };

  const [isOpen, setIsOpen] = useState<boolean>(getSavedState);

  // Toggle function
  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const newState = !prev;
      // Save to localStorage
      localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Listen for changes in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SIDEBAR_STATE_KEY && e.newValue !== null) {
        try {
          setIsOpen(JSON.parse(e.newValue));
        } catch (e) {
          // If parsing fails, do nothing
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return { isOpen, toggle };
};
