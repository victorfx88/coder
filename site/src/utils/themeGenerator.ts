// Import the customized Theme interface from our theme directory
import type { Theme } from "../theme";
import { deepmerge } from "@mui/utils";
import light from "../theme/light";
import dark from "../theme/dark";
import Color from 'color';
import { darken, lighten, setLightness } from 'polished';

// For tailwind colors, define our own gray scale
const gray = {
  100: "#f3f4f6",
  200: "#e5e7eb",
  300: "#d1d5db",
  400: "#9ca3af",
  500: "#6b7280",
  600: "#4b5563",
  700: "#374151",
  800: "#1f2937",
  900: "#111827",
};

// Constants for color theory
const CONTRAST_RATIO = 4.5; // WCAG AA standard for normal text

interface CustomThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  background: string;
  backgroundDark: string;
  text: string;
  textLight: string;
}

// Helper function to calculate simple contrast ratio between two colors
const calculateContrastRatio = (color1: ReturnType<typeof Color>, color2: ReturnType<typeof Color>): number => {
  // Get relative luminance of both colors
  const getLuminance = (c: ReturnType<typeof Color>): number => {
    const rgb = c.rgb().array();
    const [r, g, b] = rgb.map(val => {
      const normalizedVal = val / 255;
      return normalizedVal <= 0.03928 
        ? normalizedVal / 12.92 
        : Math.pow((normalizedVal + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  
  // Calculate contrast ratio
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Helper function to ensure a color has sufficient contrast with white or black text
const ensureContrast = (color: string, targetContrast: number = CONTRAST_RATIO): string => {
  const colorObj = Color(color);
  const whiteContrast = calculateContrastRatio(colorObj, Color('white'));
  const blackContrast = calculateContrastRatio(colorObj, Color('black'));

  if (whiteContrast >= targetContrast || blackContrast >= targetContrast) {
    return color;
  }

  // If contrast is insufficient, adjust lightness until it meets requirements
  if (whiteContrast > blackContrast) {
    // Darken the color for white text
    return colorObj.darken(0.5).hex();
  } else {
    // Lighten the color for black text
    return colorObj.lighten(0.5).hex();
  }
};

/**
 * Generates a set of theme colors based on a primary color using color theory
 * with enhanced contrast and vibrancy
 */
export const generateColorPalette = (primaryColor: string): CustomThemeColors => {
  // Create a color object for hue manipulation
  const color = Color(primaryColor);
  
  // Analyze the color for better adjustments
  const originalLightness = color.lightness();
  const originalSaturation = color.saturationl();
  const isLightColor = originalLightness > 60;
  const isDarkColor = originalLightness < 30;
  const isDesaturated = originalSaturation < 25;
  
  // Adjust saturation to ensure colors are vibrant enough but not too intense
  // For very desaturated colors, boost saturation more to create a more distinctive theme
  let adjustedSaturation = isDesaturated ? 
    Math.max(originalSaturation, 55) : 
    Math.max(originalSaturation, 45);
    
  // For very light colors, slightly reduce lightness to make primary more visible
  // For very dark colors, slightly increase lightness for the same reason
  let adjustedLightness = originalLightness;
  if (isLightColor) {
    adjustedLightness = Math.max(40, Math.min(85, originalLightness - 5));
  } else if (isDarkColor) {
    adjustedLightness = Math.max(25, Math.min(75, originalLightness + 10));
  }
  
  // Create adjusted color using string format for HSL
  const adjustedColor = Color(`hsl(${color.hue()}, ${adjustedSaturation}%, ${adjustedLightness}%)`);
  const adjustedPrimaryColor = adjustedColor.hex();
  
  // Generate primary shades with increased contrast for better UI distinction
  const primaryLight = lighten(0.2, adjustedPrimaryColor);
  const primaryDark = darken(0.2, adjustedPrimaryColor);
  
  // Generate a complementary color for secondary
  // Use split-complementary color scheme for better harmony (150° difference)
  const secondaryHue = (adjustedColor.hue() + 150) % 360;
  
  // Adjust secondary saturation based on primary saturation
  // More saturated primary = slightly less saturated secondary for balance
  const secondarySaturation = Math.min(90, 
    adjustedSaturation > 70 ? adjustedSaturation * 0.9 : adjustedSaturation * 1.2
  );
  
  // Adjust secondary lightness for good contrast with primary
  const secondaryLightness = Math.min(70, Math.max(40,
    isLightColor ? adjustedLightness - 15 : adjustedLightness + 15
  ));
  
  // Create secondary color using string format for HSL
  const secondaryColor = Color(`hsl(${secondaryHue}, ${secondarySaturation}%, ${secondaryLightness}%)`).hex();

  // Background colors - extremely subtle hint of primary hue
  // Light background with barely perceptible primary tint
  const background = Color(`hsl(${adjustedColor.hue()}, 3%, 97%)`).hex();
  
  // Dark background with subtle primary influence
  const backgroundDark = Color(`hsl(${adjustedColor.hue()}, 12%, 13%)`).hex();
  
  // Text colors - ensure optimal contrast while maintaining theme connection
  const text = Color(`hsl(${adjustedColor.hue()}, 5%, 10%)`).hex();
  
  const textLight = Color(`hsl(${adjustedColor.hue()}, 10%, 40%)`).hex();
  
  return {
    primary: adjustedPrimaryColor,
    primaryLight,
    primaryDark,
    secondary: secondaryColor,
    background,
    backgroundDark,
    text,
    textLight,
  };
};

/**
 * Generates a complete light or dark theme based on a primary color
 */
export const generateCustomTheme = (
  primaryColor: string, 
  mode: "light" | "dark" = "light"
): Theme => {
  // Start with a deep clone of the base theme to ensure we have all required properties
  const baseTheme = mode === "light" ? light : dark;
  const colors = generateColorPalette(primaryColor);
  
  // Create a new theme object with a more careful cloning approach
  // First start with a shallow copy of the baseTheme
  const newTheme = { ...baseTheme } as Theme;
  
  // Deep clone non-function properties using JSON
  const clonedData = JSON.parse(JSON.stringify({
    palette: baseTheme.palette || {},
    roles: baseTheme.roles || {},
    experimental: baseTheme.experimental || {},
    branding: baseTheme.branding || {},
    // Add other non-function properties here
  }));
  
  // Apply the cloned data to our new theme
  Object.assign(newTheme, clonedData);
  
  // Explicitly preserve function properties that we know are needed
  // These are critical for MUI's theme to work properly
  if (baseTheme.breakpoints) {
    newTheme.breakpoints = baseTheme.breakpoints;
  }
  
  if (baseTheme.transitions) {
    newTheme.transitions = baseTheme.transitions;
  }
  
  // Preserve any other function-containing objects as needed
  if (baseTheme.components) {
    newTheme.components = baseTheme.components;
  }
  
  if (baseTheme.spacing) {
    newTheme.spacing = baseTheme.spacing;
  }
  
  // Now our newTheme should have all original functions preserved
  
  // Analyze primary color to determine contrast needs
  const primaryColorObj = Color(colors.primary);
  const primaryColorLightness = primaryColorObj.lightness();
  const primaryHue = primaryColorObj.hue(); // Extract the hue for later use
  const isLightPrimary = primaryColorLightness > 50;
  
  // If in dark mode with a light primary color, or light mode with dark primary color,
  // we need to adjust contrast to ensure visibility
  const contrastRatio = isLightPrimary ? 
    calculateContrastRatio(primaryColorObj, Color('black')) : 
    calculateContrastRatio(primaryColorObj, Color('white'));
  
  // Calculate optimal contrast colors based on primary
  const optimalTextOnPrimary = isLightPrimary ? 
    setLightness(0.1, colors.primary) : // Dark text for light colors
    setLightness(0.95, colors.primary); // Light text for dark colors
    
  const optimalHighlightForPrimary = mode === "light" ?
    // For light mode, create a darker and more saturated primary for highlights
    darken(0.1, setLightness(0.65, colors.primary)) :
    // For dark mode, create a lighter, more vibrant primary for highlights
    lighten(0.2, setLightness(0.45, colors.primary));
  
  // Update palette with custom colors
  if (newTheme.palette) {
    // Update primary colors - make them more prominent in the theme
    if (newTheme.palette.primary) {
      newTheme.palette.primary.main = colors.primary;
      // Make primary light/dark more contrasting based on the mode
      newTheme.palette.primary.light = mode === "light" ? 
        lighten(0.15, colors.primary) : 
        lighten(0.25, colors.primary); // More contrast in dark mode
      newTheme.palette.primary.dark = mode === "light" ?
        darken(0.15, colors.primary) :
        darken(0.2, colors.primary); // Darker in dark mode for better visibility
      
      // Add contrast text color for primary
      if ('contrastText' in newTheme.palette.primary) {
        // Calculate proper contrast text based on primary color brightness
        const primaryLightness = Color(colors.primary).lightness();
        
        // Use white text for darker colors, black text for lighter colors
        // Set threshold at 55% to ensure good contrast
        newTheme.palette.primary.contrastText = primaryLightness < 55 
          ? '#ffffff' 
          : '#000000';
      }
    }
    
    // Update secondary colors - derive from primary for better harmony
    if (newTheme.palette.secondary) {
      newTheme.palette.secondary.main = colors.secondary;
      newTheme.palette.secondary.light = lighten(0.15, colors.secondary);
      newTheme.palette.secondary.dark = darken(0.15, colors.secondary);
      
      // Add contrast text color for secondary
      if ('contrastText' in newTheme.palette.secondary) {
        const secondaryObj = Color(colors.secondary);
        const secondaryLightness = secondaryObj.lightness();
        
        // Use white text for darker secondary colors, black text for lighter ones
        // Set threshold at 55% to ensure good contrast
        newTheme.palette.secondary.contrastText = secondaryLightness < 55 
          ? '#ffffff' 
          : '#000000';
      }
    }
    
    // Update background colors - make them subtly reflect the primary color
    if (newTheme.palette.background) {
      if (mode === "light") {
        // For light mode: very subtle hint of primary in background
        const primaryObj = Color(colors.primary);
        const primaryHue = primaryObj.hue();
        // Create background with proper HSL string
        newTheme.palette.background.default = Color(`hsl(${primaryHue}, 3%, 97%)`).hex();
        newTheme.palette.background.paper = "#ffffff"; // Keep white for paper elements
      } else {
        // For dark mode: add subtle depth with primary color influence
        const primaryObj = Color(colors.primary);
        const primaryHue = primaryObj.hue();
        // Create backgrounds with proper HSL strings
        newTheme.palette.background.default = Color(`hsl(${primaryHue}, 15%, 10%)`).hex();
        newTheme.palette.background.paper = Color(`hsl(${primaryHue}, 7%, 15%)`).hex();
      }
    }
    
    // Update text colors for optimal contrast
    if (newTheme.palette.text) {
      const primaryObj = Color(colors.primary);
      const primaryHue = primaryObj.hue();
      
      if (mode === "light") {
        // For light mode, derive text colors from primary but keep them dark enough for contrast
        newTheme.palette.text.primary = Color(`hsl(${primaryHue}, 5%, 10%)`).hex();
        newTheme.palette.text.secondary = Color(`hsl(${primaryHue}, 15%, 25%)`).hex();
      } else {
        // For dark mode, derive text colors from primary but keep them light enough for contrast
        newTheme.palette.text.primary = Color(`hsl(${primaryHue}, 5%, 95%)`).hex();
        newTheme.palette.text.secondary = Color(`hsl(${primaryHue}, 15%, 80%)`).hex();
      }
      
      if ('disabled' in newTheme.palette.text) {
        newTheme.palette.text.disabled = mode === "light" ? 
          Color(`hsl(${primaryHue}, 5%, 65%)`).hex() : 
          Color(`hsl(${primaryHue}, 10%, 40%)`).hex();
      }
    }
    
    // Update divider color to better match the theme
    const primaryObj = Color(colors.primary);
    const primaryHue = primaryObj.hue();
    
    newTheme.palette.divider = mode === "light" ? 
      Color(`hsl(${primaryHue}, 10%, 85%)`).hex() : 
      Color(`hsl(${primaryHue}, 15%, 25%)`).hex();
    
    // Update action colors to be more responsive to primary color
    if (newTheme.palette.action) {
      // Create action colors using HSL strings with primaryHue
      newTheme.palette.action.hover = mode === "light" 
        ? Color(`hsl(${primaryHue}, 15%, 92%)`).hex()
        : Color(`hsl(${primaryHue}, 20%, 22%)`).hex();
        
      newTheme.palette.action.selected = mode === "light"
        ? Color(`hsl(${primaryHue}, 20%, 88%)`).hex()
        : Color(`hsl(${primaryHue}, 25%, 25%)`).hex();
      
      // Update focus border for better accessibility
      if ('focus' in newTheme.palette.action) {
        // Create a color for focus outlines
        newTheme.palette.action.focus = mode === "light"
          ? Color(`hsl(${primaryHue}, 70%, 65%)`).hex()
          : Color(`hsl(${primaryHue}, 80%, 45%)`).hex();
      }
      
      // Make active state more distinctive
      if ('active' in newTheme.palette.action) {
        newTheme.palette.action.active = mode === "light"
          ? Color(`hsl(${primaryHue}, 60%, 40%)`).hex()
          : Color(`hsl(${primaryHue}, 70%, 60%)`).hex();
      }
    }
    
    // Update info, success, and warning colors to be more harmonious with primary
    // Info colors - bluish tint for info
    if (newTheme.palette.info) {
      // Get secondary color's hue for info color
      const secondaryObj = Color(colors.secondary);
      const secondaryHue = secondaryObj.hue();
      
      // Create info colors using HSL strings
      const infoBase = mode === "light" 
        ? Color(`hsl(${secondaryHue}, 70%, 50%)`).hex()
        : Color(`hsl(${secondaryHue}, 80%, 60%)`).hex();
        
      newTheme.palette.info.main = infoBase;
      newTheme.palette.info.light = lighten(0.15, infoBase);
      newTheme.palette.info.dark = darken(0.15, infoBase);
    }
    
    // Success colors - greenish variant derived from primary
    if (newTheme.palette.success) {
      // Shift hue toward green
      const successHue = (primaryHue + 140) % 360;
      const primarySat = primaryColorObj.saturationl();
      const successSat = Math.min(primarySat * 0.9, 80);
      const successLightness = mode === "light" ? 45 : 55;
      
      // Create success colors using HSL strings
      const successBase = Color(`hsl(${successHue}, ${successSat}%, ${successLightness}%)`).hex();
      
      newTheme.palette.success.main = successBase;
      newTheme.palette.success.light = lighten(0.15, successBase);
      newTheme.palette.success.dark = darken(0.15, successBase);
    }
    
    // Warning colors - orangish variant 
    if (newTheme.palette.warning) {
      // Shift hue toward orange/amber
      const warningHue = (primaryHue + 30) % 360;
      const primarySat = primaryColorObj.saturationl();
      const warningSat = Math.min(primarySat * 1.1, 90);
      const warningLightness = mode === "light" ? 50 : 60;
      
      // Create warning colors using HSL strings
      const warningBase = Color(`hsl(${warningHue}, ${warningSat}%, ${warningLightness}%)`).hex();
      
      newTheme.palette.warning.main = warningBase;
      newTheme.palette.warning.light = lighten(0.15, warningBase);
      newTheme.palette.warning.dark = darken(0.15, warningBase);
    }
    
    // Error colors - reddish variant
    if (newTheme.palette.error) {
      // Shift hue toward red
      const errorHue = (primaryHue + 330) % 360;
      const primarySat = primaryColorObj.saturationl();
      const errorSat = Math.min(primarySat * 1.1, 90);
      const errorLightness = mode === "light" ? 50 : 60;
      
      // Create error colors using HSL strings
      const errorBase = Color(`hsl(${errorHue}, ${errorSat}%, ${errorLightness}%)`).hex();
      
      newTheme.palette.error.main = errorBase;
      newTheme.palette.error.light = lighten(0.15, errorBase);
      newTheme.palette.error.dark = darken(0.15, errorBase);
    }
  }

  // Update experimental theme properties
  if (newTheme.experimental) {
    // L1 updates
    if (newTheme.experimental.l1) {
      newTheme.experimental.l1.background = mode === "light" ? colors.background : colors.backgroundDark;
      
      // Create outline color with HSL
      newTheme.experimental.l1.outline = mode === "light" 
        ? Color(`hsl(${primaryHue}, 50%, 80%)`).hex() 
        : Color(`hsl(${primaryHue}, 60%, 40%)`).hex();
        
      newTheme.experimental.l1.text = mode === "light" ? colors.text : "#ffffff";
      
      if (newTheme.experimental.l1.fill) {
        newTheme.experimental.l1.fill.solid = mode === "light" ? colors.primaryLight : colors.primaryDark;
        newTheme.experimental.l1.fill.outline = mode === "light" ? colors.primary : colors.primaryLight;
      }
    }
    
    // L2 updates
    if (newTheme.experimental.l2) {
      // Create L2 background with HSL
      newTheme.experimental.l2.background = mode === "light"
        ? Color(`hsl(${primaryHue}, 10%, 97%)`).hex()
        : Color(`hsl(${primaryHue}, 20%, 15%)`).hex();
        
      // Create L2 outline with HSL
      newTheme.experimental.l2.outline = mode === "light"
        ? Color(`hsl(${primaryHue}, 30%, 75%)`).hex()
        : Color(`hsl(${primaryHue}, 40%, 50%)`).hex();
      
      if (newTheme.experimental.l2.hover) {
        // Create L2 hover background with HSL
        newTheme.experimental.l2.hover.background = mode === "light"
          ? Color(`hsl(${primaryHue}, 20%, 90%)`).hex()
          : Color(`hsl(${primaryHue}, 30%, 20%)`).hex();
      }
    }
    
    // Pill default updates
    if (newTheme.experimental.pillDefault) {
      // Create pill background with HSL
      newTheme.experimental.pillDefault.background = mode === "light"
        ? Color(`hsl(${primaryHue}, 25%, 90%)`).hex()
        : Color(`hsl(${primaryHue}, 35%, 20%)`).hex();
        
      // Create pill outline with HSL
      newTheme.experimental.pillDefault.outline = mode === "light"
        ? Color(`hsl(${primaryHue}, 35%, 80%)`).hex()
        : Color(`hsl(${primaryHue}, 45%, 40%)`).hex();
    }
  }

  // Update roles
  if (newTheme.roles) {
    // Active role updates
    if (newTheme.roles.active) {
      // Create active background with HSL
      newTheme.roles.active.background = mode === "light"
        ? Color(`hsl(${primaryHue}, 30%, 90%)`).hex()
        : Color(`hsl(${primaryHue}, 40%, 20%)`).hex();
        
      newTheme.roles.active.outline = colors.primary;
      newTheme.roles.active.text = mode === "light" ? colors.primary : colors.primaryLight;
      
      if (newTheme.roles.active.fill) {
        newTheme.roles.active.fill.solid = colors.primary;
        newTheme.roles.active.fill.outline = colors.primaryLight;
      }
    }
    
    // Info role updates
    if (newTheme.roles.info) {
      // Get secondary hue for info colors
      const secondaryObj = Color(colors.secondary);
      const secondaryHue = secondaryObj.hue();
      
      // Create info role colors with HSL
      newTheme.roles.info.background = mode === "light"
        ? Color(`hsl(${secondaryHue}, 25%, 95%)`).hex()
        : Color(`hsl(${secondaryHue}, 35%, 15%)`).hex();
        
      newTheme.roles.info.outline = colors.secondary;
      
      newTheme.roles.info.text = mode === "light"
        ? Color(`hsl(${secondaryHue}, 60%, 30%)`).hex()
        : colors.secondary;
    }
  }

  // Verify critical functions exist before returning
  if (!newTheme.breakpoints?.up || typeof newTheme.breakpoints.up !== 'function') {
    console.warn('Theme generation: breakpoints.up function is missing in the generated theme');
  }
  
  if (!newTheme.transitions?.create || typeof newTheme.transitions.create !== 'function') {
    console.warn('Theme generation: transitions.create function is missing in the generated theme');
  }
  
  return newTheme;
};

/**
 * Saves custom theme settings to localStorage
 */
export const saveCustomThemeToLocalStorage = (
  primaryColor: string,
): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem("customThemePrimaryColor", primaryColor);
  }
};

/**
 * Gets custom theme settings from localStorage
 */
export const getCustomThemeFromLocalStorage = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem("customThemePrimaryColor");
  }
  return null;
};

/**
 * Checks if user has a custom theme
 */
export const hasCustomTheme = (): boolean => {
  return !!getCustomThemeFromLocalStorage();
};