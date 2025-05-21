import {FC, ReactNode, useCallback, useRef, MouseEvent} from "react";
import {Outlet} from "react-router-dom";
import {ChatSidebar} from "../components/ChatSidebar/ChatSidebar";
import {useSidebar} from "../contexts/SidebarContext";
import {css} from "@emotion/react";

interface MainLayoutProps {
  children?: ReactNode;
}

export const MainLayout: FC<MainLayoutProps> = () => {
  const { isOpen, toggle, width, setWidth, isResizing, setIsResizing } = useSidebar();
  const resizerRef = useRef<HTMLDivElement>(null);

  // Set the sidebar width based on state
  const sidebarWidth = isOpen ? `${width}px` : "40px";

  // Handle mouse down on the resizer
  const handleResizeStart = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = width;
    
    const handleResize = (moveEvent: MouseEvent | globalThis.MouseEvent) => {
      // Calculate the new width based on mouse position
      const newWidth = startWidth - (moveEvent.clientX - startX);
      setWidth(newWidth);
    };
    
    const handleResizeEnd = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleResize as any);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
    
    document.addEventListener('mousemove', handleResize as any);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [width, setWidth, setIsResizing]);

  return (
    <div
      css={css`
        display: flex;
        height: 100vh;
        width: 100%;
        overflow-x: hidden;
      `}
    >
      {/* Main content area that resizes when sidebar changes */}
      <div
        css={css`
          flex: 1;
          min-width: 0; /* Prevent flex items from overflowing */
          transition: ${isResizing ? 'none' : 'width 0.3s ease-in-out'};
          width: calc(100% - ${sidebarWidth});
          overflow-y: auto;
        `}
      >
        <Outlet />
      </div>

      {/* Resizer handle with white indicator */}
      {isOpen && (
        <div
          ref={resizerRef}
          css={css`
            position: absolute;
            right: ${sidebarWidth};
            top: 0;
            bottom: 0;
            width: 6px;
            cursor: ew-resize;
            z-index: 999;
            
            &:hover::before,
            &:active::before {
              content: "";
              position: absolute;
              left: 2px;
              top: 0;
              bottom: 0;
              width: 2px;
              background-color: white;
            }
          `}
          onMouseDown={handleResizeStart}
        />
      )}

      {/* Chat sidebar that's part of the layout flow */}
      <div
        css={css`
          width: ${sidebarWidth};
          min-width: ${sidebarWidth}; /* Ensure minimum width is respected */
          max-width: ${sidebarWidth}; /* Ensure maximum width is respected */
          transition: ${isResizing ? 'none' : 'width 0.3s ease-in-out'};
          overflow: hidden;
          flex-shrink: 0;
          position: relative; /* To allow for absolute positioning of button */
        `}
        id="chat-sidebar-wrapper"
      >
        <ChatSidebar isOpen={isOpen} onToggle={toggle} />
      </div>
    </div>
  );
};

// Add default export for lazy loading compatibility
export default MainLayout;
