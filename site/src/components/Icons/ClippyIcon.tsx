import {FC} from 'react';

interface ClippyIconProps {
  size?: number;
  color?: string;
}

export const ClippyIcon: FC<ClippyIconProps> = ({ size = 24, color = 'currentColor' }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Chat bubble with message */}
      <path
        d="M19 4H5C3.89543 4 3 4.89543 3 6V15C3 16.1046 3.89543 17 5 17H8V20L12 17H19C20.1046 17 21 16.1046 21 15V6C21 4.89543 20.1046 4 19 4Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Message lines */}
      <path
        d="M7 9H17"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 13H13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};
