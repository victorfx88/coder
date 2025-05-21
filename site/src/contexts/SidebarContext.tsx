import {createContext, FC, ReactNode, useCallback, useContext, useEffect, useState} from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  width: number;
  setWidth: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (isResizing: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  toggle: () => {},
  width: 300,
  setWidth: () => {},
  isResizing: false,
  setIsResizing: () => {},
});

// Constants
const MIN_WIDTH = 200;
const DEFAULT_WIDTH = 300;
const SIDEBAR_WIDTH_KEY = "chat-sidebar-width";

export const SidebarProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // State
  const [isOpen, setIsOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // Calculate max width (50% of viewport)
  const getMaxWidth = useCallback(() => Math.floor(window.innerWidth * 0.5), []);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (savedWidth) {
        const parsedWidth = Math.min(
          Math.max(parseInt(savedWidth, 10), MIN_WIDTH),
          getMaxWidth()
        );
        if (!isNaN(parsedWidth)) {
          setWidth(parsedWidth);
        }
      }
    } catch (e) {
      console.error("Error loading sidebar width", e);
    }
  }, [getMaxWidth]);

  // Toggle sidebar open/close
  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Update width with constraints & save to localStorage
  const updateWidth = useCallback((newWidth: number) => {
    const constrainedWidth = Math.min(
      Math.max(newWidth, MIN_WIDTH),
      getMaxWidth()
    );
    
    setWidth(constrainedWidth);
    
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, constrainedWidth.toString());
    } catch (e) {
      // Silent fail - localStorage is not critical
    }
  }, [getMaxWidth]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const maxWidth = getMaxWidth();
      if (width > maxWidth) {
        setWidth(maxWidth);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getMaxWidth, width]);

  // Manage resize styling
  useEffect(() => {
    if (isResizing) {
      document.body.classList.add('sidebar-resizing');
      document.body.style.cursor = 'ew-resize';
    } else {
      document.body.classList.remove('sidebar-resizing');
      document.body.style.cursor = '';
    }
  }, [isResizing]);

  return (
    <SidebarContext.Provider 
      value={{ 
        isOpen, 
        toggle, 
        width, 
        setWidth: updateWidth, 
        isResizing, 
        setIsResizing 
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
