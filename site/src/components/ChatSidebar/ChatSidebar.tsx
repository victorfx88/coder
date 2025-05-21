import {ChangeEvent, FC, FormEvent, useEffect, useRef, useState} from "react";
import {FileDown, GitFork, MessageSquare, RotateCw, Send, ThumbsUp, XCircle} from "lucide-react";
import type {Interpolation, Theme} from "@emotion/react";
import {ClippyIcon} from "../Icons/ClippyIcon";
import {useSidebar} from "../../contexts/SidebarContext";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  status?: 'sending' | 'sent' | 'error';
  timestamp?: Date;
  hasCodeBlock?: boolean;
  codeBlock?: {
    language: string;
    code: string;
  };
  hasAttachment?: boolean;
  attachment?: {
    name: string;
    size: string;
    type: string;
    url?: string;
  };
  isPermissionRequest?: boolean;
  permissionType?: 'filesystem' | 'network' | 'userinfo';
}

export const ChatSidebar: FC<{
  // These props are optional now since we can use context
  isOpen?: boolean;
  onToggle?: () => void
}> = ({
  // Default to context values if props aren't provided
  isOpen: isOpenProp,
  onToggle: onToggleProp,
}) => {
  const sidebarContext = useSidebar();

  // Use props if provided, otherwise use context
  const isOpen = isOpenProp !== undefined ? isOpenProp : sidebarContext.isOpen;
  const onToggle = onToggleProp || sidebarContext.toggle;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm your AI assistant. How can I help you today?",
      isUser: false,
      status: 'sent',
      timestamp: new Date(Date.now() - 60000), // 1 minute ago
    },
    {
      id: "2",
      text: "I'd like to analyze my codebase performance",
      isUser: true,
      status: 'sent',
      timestamp: new Date(Date.now() - 45000), // 45 seconds ago
    },
    {
      id: "3",
      text: "I'd be happy to help analyze your codebase performance. To do that, I'll need access to your project files.",
      isUser: false,
      status: 'sent',
      timestamp: new Date(Date.now() - 30000), // 30 seconds ago
      isPermissionRequest: true,
      permissionType: 'filesystem',
    },
    {
      id: "4",
      text: "Sure, I grant access to my project files.",
      isUser: true,
      status: 'sent',
      timestamp: new Date(Date.now() - 20000), // 20 seconds ago
    },
    {
      id: "5",
      text: "Thank you. I'm now analyzing your codebase for performance issues. This may take a moment...",
      isUser: false,
      status: 'sent',
      timestamp: new Date(Date.now() - 15000), // 15 seconds ago
    },
  ]);
  const [isTyping, setIsTyping] = useState(true); // Start with typing indicator
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);
  
  // Simulate completion of initial analysis
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: "6",
          text: "I've completed my analysis of your codebase. I've identified several potential performance bottlenecks:",
          isUser: false,
          status: 'sent',
          timestamp: new Date(),
        } as Message,
        {
          id: "7",
          text: "Here's a Terraform configuration example for your infrastructure:",
          isUser: false,
          status: 'sent',
          timestamp: new Date(),
          hasCodeBlock: true,
          codeBlock: {
            language: 'terraform',
            code: `# Configure the AWS Provider
provider "aws" {
  region = "us-west-2"
  tags = {
    Environment = var.environment
    Project     = "CodeDemo"
  }
}

# Create a VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "main-vpc"
  }
}

# Create public subnet
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-west-2a"
  map_public_ip_on_launch = true

  tags = {
    Name = "public-subnet"
  }
}

# Create security group
resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Security group for web servers"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`
          }
        } as Message
      ]);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  const [newMessage, setNewMessage] = useState("");

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      text: newMessage,
      isUser: true,
      status: 'sending', // Start with sending status
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");

    // Simulate message sending delay
    setTimeout(() => {
      // Update message status to sent
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? {...msg, status: 'sent' as const} 
            : msg
        )
      );
      
      // Then show typing indicator
      setIsTyping(true);
      
      // Handle different scenarios based on message content
      if (newMessage.toLowerCase().includes('file upload')) {
        // Show file upload permission request
        setTimeout(() => {
          setIsTyping(false);
          setShowPermissionAlert(true);
          const aiResponse: Message = {
            id: Date.now().toString(),
            text: "I'll need access to your file system to help with uploads. Please grant permission.",
            isUser: false,
            status: 'sent',
            timestamp: new Date(),
            isPermissionRequest: true,
            permissionType: 'filesystem',
          };
          setMessages(prev => [...prev, aiResponse]);
        }, 1500);
      }
      else if (newMessage.toLowerCase().includes('code sample') || newMessage.toLowerCase().includes('example')) {
        // Provide code sample
        setTimeout(() => {
          setIsTyping(false);
          const aiResponse: Message = {
            id: Date.now().toString(),
            text: "Here's a simple React component example:",
            isUser: false,
            status: 'sent',
            timestamp: new Date(),
            hasCodeBlock: true,
            codeBlock: {
              language: 'typescript',
              code: `import React, { useState } from 'react';

const Counter: React.FC = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
};

export default Counter;`,
            },
          };
          setMessages(prev => [...prev, aiResponse]);
        }, 2000);
      }
      else if (newMessage.toLowerCase().includes('download') || newMessage.toLowerCase().includes('report')) {
        // Offer download
        setTimeout(() => {
          setIsTyping(false);
          const aiResponse: Message = {
            id: Date.now().toString(),
            text: "I've prepared a performance report for you:",
            isUser: false,
            status: 'sent',
            timestamp: new Date(),
            hasAttachment: true,
            attachment: {
              name: "performance_report.pdf",
              size: "2.4 MB",
              type: "application/pdf",
              url: "#",
            },
          };
          setMessages(prev => [...prev, aiResponse]);
        }, 2500);
      }
      else {
        // Standard response with thinking time
        setTimeout(() => {
          setIsTyping(false);
          
          // First part of response
          const aiResponse1: Message = {
            id: Date.now().toString(),
            text: `I understand you're asking about "${newMessage}". Let me analyze that for you.`,
            isUser: false,
            status: 'sent',
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, aiResponse1]);
          
          // Show typing again for second part
          setIsTyping(true);
          
          // Second part with delay to simulate thinking
          setTimeout(() => {
            setIsTyping(false);
            const aiResponse2: Message = {
              id: Date.now().toString(),
              text: "Based on my analysis, I recommend optimizing your workflow by implementing automated testing and continuous integration.",
              isUser: false,
              status: 'sent',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiResponse2]);
          }, 3000);
        }, 1800);
      }
    }, 800); // Delay to simulate sending
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  };

  // Function to simulate message error - to be used for demonstrating error states
  const simulateMessageError = () => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: "Can you search the web for current market trends?",
      isUser: true,
      status: 'sending',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage("");
    
    // Simulate error after a short delay
    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? {...msg, status: 'error' as const} 
            : msg
        )
      );
      
      // Add error message
      setTimeout(() => {
        const errorMessage: Message = {
          id: Date.now().toString(),
          text: "I'm unable to search the web right now. This feature requires additional permissions or may be temporarily unavailable.",
          isUser: false,
          status: 'sent',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }, 1000);
    }, 2000);
  };
  
  // New button function to handle various actions like retry, copy, etc.
  const handleMessageAction = (messageId: string, action: string) => {
    if (action === 'retry') {
      // Find the message
      const messageToRetry = messages.find(m => m.id === messageId);
      if (messageToRetry && messageToRetry.status === 'error') {
        // Update status to sending
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? {...msg, status: 'sending' as const} 
              : msg
          )
        );
        
        // Simulate successful retry
        setTimeout(() => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === messageId 
                ? {...msg, status: 'sent' as const} 
                : msg
            )
          );
          
          setIsTyping(true);
          
          // Add AI response
          setTimeout(() => {
            setIsTyping(false);
            const aiResponse: Message = {
              id: Date.now().toString(),
              text: "I've successfully completed the request you retried. Here's the information you requested.",
              isUser: false,
              status: 'sent',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiResponse]);
          }, 2000);
        }, 1500);
      }
    } else if (action === 'copy') {
      // Simulate copy action
      const messageToCopy = messages.find(m => m.id === messageId);
      if (messageToCopy) {
        // In a real application, you would copy to clipboard
        console.log("Copied:", messageToCopy.text);
        
        // Show temporary notification
        // This would be implemented with a toast notification in a real app
      }
    }
  };

  // Debug the state
  console.log("ChatSidebar rendered with isOpen:", isOpen);

  // Handle toggle with a wrapper that includes logging
  const handleToggle = () => {
    console.log("Toggle button clicked, current state:", isOpen);
    onToggle();
  };

  return (
    <div
      css={styles.sidebarContainer}
      data-open={isOpen}
      className="ai-sidebar"
    >
      {/* Fixed position button */}
      <button
        css={styles.fixedButton}
        onClick={handleToggle}
        aria-label={isOpen ? "Collapse AI Assistant" : "Expand AI Assistant"}
        title={isOpen ? "Collapse AI Assistant" : "Expand AI Assistant"}
      >
        <ClippyIcon size={18} color="white" />
      </button>

      {isOpen ? (
        <>
          <div css={styles.sidebarHeader}>
            <div css={styles.headerTitle}>
              <MessageSquare size={18} />
              <h2>AI Assistant</h2>
            </div>
          </div>

          <div css={styles.messagesContainer}>
            {showPermissionAlert && (
              <div css={styles.permissionAlert}>
                <p>This AI assistant is requesting permission to:</p>
                <p css={styles.permissionType}>Access filesystem</p>
                <div css={styles.permissionButtons}>
                  <button css={styles.denyButton} onClick={() => setShowPermissionAlert(false)}>
                    <XCircle size={16} /> Deny
                  </button>
                  <button css={styles.allowButton} onClick={() => setShowPermissionAlert(false)}>
                    <ThumbsUp size={16} /> Allow
                  </button>
                </div>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                css={[styles.message, message.isUser ? styles.userMessage : styles.aiMessage]}
              >
                <div css={styles.messageContent}>
                  {message.text}
                  
                  {/* Code block */}
                  {message.hasCodeBlock && (
                    <div css={styles.codeBlock}>
                      <div css={styles.codeHeader}>
                        <span>{message.codeBlock?.language}</span>
                        <button css={styles.copyButton}>Copy</button>
                      </div>
                      <pre css={styles.codeContent}>
                        <code>
                          {message.codeBlock?.code.split('\n').map((line, index) => {
                            return (
                              <div key={index} className="code-line">
                                {/* Apply syntax highlighting with styled spans instead of innerHTML */}
                                {line.match(/^\s*#.*$/) ? (
                                  <span className="comment">{line}</span>
                                ) : (
                                  <>
                                    {line
                                      // HCL/Terraform specific highlighting
                                      .replace(/\b(provider|resource|variable|output|module|data|locals|terraform)\b/g, "__KEYWORD__$1__KEYWORD__")
                                      .replace(/\b(true|false|null|for_each|count|depends_on|lifecycle|create_before_destroy|prevent_destroy|ignore_changes)\b/g, "__KEYWORD__$1__KEYWORD__")
                                      .replace(/\b(var|local|module|data|path|fileset|file|timestamp|uuid|base64encode|base64decode|cidrhost|templatefile)\b/g, "__BUILTIN__$1__BUILTIN__")
                                      .replace(/\b(string|number|bool|list|map|set|object|tuple|any)\b/g, "__TYPE__$1__TYPE__")
                                      .replace(/(['"])(?:(?!\1).)*\1/g, m => `__STRING__${m}__STRING__`)
                                      .replace(/\b(\d+\.?\d*|\.\d+)\b/g, "__NUMBER__$1__NUMBER__")
                                      .replace(/\b(\w+)(?=\s*\()/g, "__FUNCTION__$1__FUNCTION__")
                                      .replace(/([{}()\[\]])/g, "__BRACKET__$1__BRACKET__")
                                      .replace(/(=|\+|-|\*|\/|>|<|>=|<=|==|!=|!|&&|\|\||\?|:|\.|,|;)/g, "__OPERATOR__$1__OPERATOR__")
                                      .split(/__(?:(KEYWORD|BUILTIN|TYPE|STRING|NUMBER|FUNCTION|BRACKET|OPERATOR)__)([^_]*)__\1__/g)
                                      .map((part, i) => {
                                        if (i % 3 === 0) return part;
                                        if (i % 3 === 1) return null; // Skip the tag name
                                        
                                        const type = RegExp.$1?.toLowerCase();
                                        const content = part;
                                        
                                        switch (type) {
                                          case 'keyword': return <span className="keyword">{content}</span>;
                                          case 'builtin': return <span className="builtin">{content}</span>;
                                          case 'type': return <span className="type">{content}</span>;
                                          case 'string': return <span className="string">{content}</span>;
                                          case 'number': return <span className="number">{content}</span>;
                                          case 'function': return <span className="function">{content}</span>;
                                          case 'bracket': return <span className="bracket">{content}</span>;
                                          case 'operator': return <span className="operator">{content}</span>;
                                          default: return content;
                                        }
                                      })}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </code>
                      </pre>
                    </div>
                  )}
                  
                  {/* File attachment */}
                  {message.hasAttachment && (
                    <div css={styles.attachment}>
                      <div css={styles.attachmentInfo}>
                        <span css={styles.attachmentName}>{message.attachment?.name}</span>
                        <span css={styles.attachmentSize}>{message.attachment?.size}</span>
                      </div>
                      <button css={styles.downloadButton}>
                        <FileDown size={16} /> Download
                      </button>
                    </div>
                  )}
                  
                  {/* Permission request */}
                  {message.isPermissionRequest && (
                    <div css={styles.permissionRequest}>
                      <div css={styles.permissionType}>
                        <GitFork size={16} />
                        {message.permissionType === 'filesystem' && 'Filesystem access'}
                        {message.permissionType === 'network' && 'Network access'}
                        {message.permissionType === 'userinfo' && 'User information access'}
                      </div>
                      <div css={styles.permissionButtons}>
                        <button css={styles.denyButton}>
                          <XCircle size={16} /> Deny
                        </button>
                        <button css={styles.allowButton}>
                          <ThumbsUp size={16} /> Allow
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Message timestamp */}
                {message.timestamp && (
                  <div css={styles.timestamp}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                
                {/* Message status indicator (for user messages) */}
                {message.isUser && message.status && (
                  <div css={styles.statusIndicator}>
                    {message.status === 'sending' && <RotateCw size={12} css={styles.loadingIcon} />}
                    {message.status === 'sent' && <span css={styles.sentIcon}>✓</span>}
                    {message.status === 'error' && (
                      <div css={styles.errorContainer}>
                        <XCircle size={12} css={styles.errorIcon} />
                        <button 
                          css={styles.retryButton}
                          onClick={() => handleMessageAction(message.id, 'retry')}
                          aria-label="Retry message"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div css={[styles.message, styles.aiMessage, styles.typingIndicator]}>
                <span css={styles.typingDot}></span>
                <span css={styles.typingDot}></span>
                <span css={styles.typingDot}></span>
              </div>
            )}
            
            {/* Add error demonstration button - this would be removed in production */}
            <div css={styles.demoControls}>
              <button 
                css={styles.demoButton}
                onClick={simulateMessageError}
                title="Simulate a message error"
              >
                Simulate Error
              </button>
            </div>
            
            <div css={styles.messageSpacer} ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} css={styles.inputForm}>
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Type your message..."
              css={styles.messageInput}
            />
            <button
              type="submit"
              css={styles.sendButton}
              disabled={!newMessage.trim() || isTyping}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
          
          <div css={styles.disclaimerFooter}>
            AI responses may be inaccurate or contain errors. You should review and verify all information.
          </div>
        </>
      ) : (
        <div css={styles.collapsedContainer} onClick={handleToggle}>
          {/* Removed ClippyIcon to avoid duplicate */}
        </div>
      )}
    </div>
  );
};

const styles = {
  sidebarContainer: (theme) => ({
    height: "100%",
    width: "100%", // Ensure the sidebar takes full width of its container
    backgroundColor: theme.palette.background.paper,
    borderLeft: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
    transition: "width 0.3s ease-in-out",
    position: "relative", // Changed from fixed to relative for layout flow
  }),

  collapsedContainer: (theme) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.paper,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    padding: "8px",
  }),

  fixedButton: (theme) => ({
    position: "absolute",
    left: 0,
    top: "50%",
    transform: "translateY(-50%) translateX(-50%)", // Center the button on the edge
    width: "32px",
    height: "32px",
    backgroundColor: theme.palette.primary.main, // Match theme primary color
    color: "white",
    border: "none",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 1000, // Ensure it's above other elements
    padding: 0, // Remove padding
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    overflow: "visible", // Make sure icon isn't cut
    "&:hover": {
      backgroundColor: theme.palette.primary.dark, // Use theme dark variant
    },
    "& svg": {
      width: "20px", // Fixed size for the icon
      height: "20px",
    },
  }),

  sidebarHeader: (theme) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottom: `1px solid ${theme.palette.divider}`,
  }),

  headerTitle: () => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 500,

    "& h2": {
      margin: 0,
      fontSize: 16,
    },
  }),

  messagesContainer: () => ({
    flex: 1,
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),

  message: () => ({
    padding: "10px 14px",
    borderRadius: 12,
    maxWidth: "85%",
    wordBreak: "break-word",
  }),

  userMessage: (theme) => ({
    alignSelf: "flex-end",
    backgroundColor: theme.palette.primary.main,
    color: "white",
    borderBottomRightRadius: 4,
  }),

  aiMessage: (theme) => ({
    alignSelf: "flex-start",
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
    borderBottomLeftRadius: 4,
  }),

  messageSpacer: () => ({
    flexGrow: 1,
  }),

  inputForm: (theme) => ({
    padding: 16,
    display: "flex",
    gap: 8,
    borderTop: `1px solid ${theme.palette.divider}`,
  }),

  messageInput: (theme) => ({
    flex: 1,
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontSize: 14,

    "&:focus": {
      outline: "none",
      borderColor: theme.palette.primary.main,
    },
  }),
  
  // New styles for enhanced features
  messageContent: () => ({
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }),
  
  timestamp: (theme) => ({
    fontSize: 10,
    color: theme.palette.text.secondary,
    alignSelf: "flex-end",
    marginTop: 4,
  }),
  
  statusIndicator: () => ({
    display: "inline-flex",
    alignItems: "center",
    marginLeft: 4,
    fontSize: 12,
  }),
  
  loadingIcon: () => ({
    animation: "spin 1s linear infinite",
    "@keyframes spin": {
      "0%": { transform: "rotate(0deg)" },
      "100%": { transform: "rotate(360deg)" },
    },
  }),
  
  sentIcon: (theme) => ({
    color: theme.palette.success.main,
  }),
  
  errorIcon: (theme) => ({
    color: theme.palette.error.main,
  }),
  
  errorContainer: () => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
  }),
  
  retryButton: (theme) => ({
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    border: `1px solid ${theme.palette.error.main}`,
    backgroundColor: "transparent",
    color: theme.palette.error.main,
    cursor: "pointer",
    marginLeft: 2,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  }),
  
  typingIndicator: () => ({
    padding: 10,
    minHeight: 0,
    display: "flex",
    gap: 4,
    alignItems: "center",
  }),
  
  typingDot: () => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "currentColor",
    opacity: 0.6,
    display: "inline-block",
    animation: "bounce 1.4s infinite ease-in-out both",
    "&:nth-of-type(1)": { animationDelay: "-0.32s" },
    "&:nth-of-type(2)": { animationDelay: "-0.16s" },
    "@keyframes bounce": {
      "0%, 80%, 100%": { transform: "scale(0)" },
      "40%": { transform: "scale(1)" },
    },
  }),
  
  codeBlock: (theme) => ({
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.mode === 'dark' ? '#1E1E1E' : '#F5F5F5', // VS Code-like backgrounds
  }),
  
  codeHeader: (theme) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: theme.palette.mode === 'dark' ? '#252526' : '#E8E8E8', // VS Code-like header
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: 12,
    color: theme.palette.mode === 'dark' ? '#CCCCCC' : '#333333',
  }),
  
  copyButton: (theme) => ({
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 4,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: "transparent",
    color: theme.palette.text.secondary,
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  }),
  
  codeContent: (theme) => ({
    margin: 0,
    padding: 12,
    overflowX: "auto",
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.45,
    backgroundColor: theme.palette.mode === 'dark' ? '#1E1E1E' : '#F5F5F5', // VS Code-like background
    color: theme.palette.mode === 'dark' ? '#D4D4D4' : '#333333',
    maxHeight: "400px", // Prevent very long code blocks from taking too much space
    
    // Line numbers and highlighting
    position: 'relative',
    counterReset: 'line',
    '& > code > div.code-line': {
      padding: '0 4px',
      width: '100%',
      display: 'block',
      counterIncrement: 'line',
      position: 'relative',
      paddingLeft: '3.5em',
      '&:hover': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      },
      '&::before': {
        content: 'counter(line)',
        position: 'absolute',
        left: 0,
        top: 0,
        width: '3em',
        textAlign: 'right',
        color: theme.palette.mode === 'dark' ? '#858585' : '#AAAAAA',
        paddingRight: '0.5em',
      }
    },
    
    // Direct class selectors for syntax highlighting
    '& .keyword': { 
      color: theme.palette.mode === 'dark' ? '#569CD6' : '#0000FF'
    },
    '& .string': { 
      color: theme.palette.mode === 'dark' ? '#CE9178' : '#A31515'
    },
    '& .comment': { 
      color: theme.palette.mode === 'dark' ? '#6A9955' : '#008000', 
      fontStyle: 'italic',
      display: 'block' // Make comments take the full line
    },
    '& .function': { 
      color: theme.palette.mode === 'dark' ? '#DCDCAA' : '#795E26'
    },
    '& .operator': { 
      color: theme.palette.mode === 'dark' ? '#D4D4D4' : '#000000'
    },
    '& .bracket': { 
      color: theme.palette.mode === 'dark' ? '#D4D4D4' : '#000000' 
    },
    '& .number': { 
      color: theme.palette.mode === 'dark' ? '#B5CEA8' : '#098658'
    },
    '& .type': { 
      color: theme.palette.mode === 'dark' ? '#4EC9B0' : '#267F99'
    },
    '& .class': { 
      color: theme.palette.mode === 'dark' ? '#4EC9B0' : '#267F99'
    },
    '& .tag': { 
      color: theme.palette.mode === 'dark' ? '#569CD6' : '#800000'
    },
    '& .builtin': { 
      color: theme.palette.mode === 'dark' ? '#4EC9B0' : '#0070C1'
    },
    '& .attr-name': { 
      color: theme.palette.mode === 'dark' ? '#9CDCFE' : '#FF0000'
    },
    '& .attr-value': { 
      color: theme.palette.mode === 'dark' ? '#CE9178' : '#A31515'
    }
  }),
  
  attachment: (theme) => ({
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),
  
  attachmentInfo: () => ({
    display: "flex",
    flexDirection: "column",
  }),
  
  attachmentName: (theme) => ({
    fontWeight: 500,
    color: theme.palette.text.primary,
  }),
  
  attachmentSize: (theme) => ({
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
  }),
  
  downloadButton: (theme) => ({
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 10px",
    borderRadius: 4,
    border: "none",
    backgroundColor: theme.palette.primary.main,
    color: "white",
    fontSize: 12,
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  }),
  
  permissionRequest: (theme) => ({
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
  }),
  
  permissionAlert: (theme) => ({
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    border: `1px solid ${theme.palette.warning.light}`,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
    fontSize: 14,
  }),
  
  demoControls: (theme) => ({
    display: "flex",
    justifyContent: "center",
    margin: "12px 0",
    padding: "8px 0",
    borderTop: `1px dashed ${theme.palette.divider}`,
    borderBottom: `1px dashed ${theme.palette.divider}`,
  }),
  
  demoButton: (theme) => ({
    padding: "4px 12px",
    fontSize: 12,
    borderRadius: 4,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  }),
  
  permissionType: (theme) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 500,
    color: theme.palette.text.primary,
    marginTop: 4,
    marginBottom: 8,
  }),
  
  permissionButtons: () => ({
    display: "flex",
    gap: 8,
    marginTop: 12,
  }),
  
  denyButton: (theme) => ({
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    borderRadius: 4,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: "transparent",
    color: theme.palette.text.primary,
    fontSize: 13,
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  }),
  
  allowButton: (theme) => ({
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    borderRadius: 4,
    border: "none",
    backgroundColor: theme.palette.primary.main,
    color: "white",
    fontSize: 13,
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  }),
  
  disclaimerFooter: (theme) => ({
    padding: "8px 16px",
    borderTop: `1px solid ${theme.palette.divider}`,
    fontSize: 11,
    color: theme.palette.text.secondary,
    textAlign: "center",
    backgroundColor: theme.palette.background.default,
  }),
  

  sendButton: (theme) => ({
    backgroundColor: theme.palette.primary.main,
    color: "white",
    border: "none",
    borderRadius: 8,
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",

    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  }),
} satisfies Record<string, Interpolation<Theme>>;
