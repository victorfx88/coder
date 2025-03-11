# Coder Theming System

## Overview

Coder's theming system provides a flexible way to customize the appearance of the application. It supports:

1. Pre-defined themes (light and dark)
2. Auto theme (follows system preference)
3. Custom themes generated from a primary color

## Theme Structure

Each theme consists of the following components:

- **Palette**: The main color palette used by MUI components
- **Roles**: Semantic color groups for specific UI purposes
- **Experimental**: New theme features being tested
- **Branding**: Marketing-related theme colors
- **Monaco**: Editor theming

## Custom Theming

The custom theming system allows users to:

1. Select a primary color using a color picker
2. Generate a complete theme based on color theory
3. Save their preferences to localStorage

### How Custom Themes Work

When a user selects a custom theme:

1. The primary color is used to generate a full color palette
2. Color theory is applied to create complementary and supporting colors
3. Both light and dark versions of the custom theme are generated
4. The theme is saved to localStorage for persistence

### Theme Generation

The `themeGenerator.ts` utility provides the following functions:

- `generateColorPalette`: Creates a set of theme colors from a primary color
- `generateCustomTheme`: Builds a complete theme object from a primary color
- `saveCustomThemeToLocalStorage`: Persists the theme preference
- `getCustomThemeFromLocalStorage`: Retrieves saved theme preferences
- `hasCustomTheme`: Checks if a custom theme exists

## Usage

Users can select a theme from their account settings. The theme will persist across sessions using localStorage.

## Implementation Details

The theming system is implemented across several files:

- `theme/index.ts`: Theme definitions and exports
- `contexts/ThemeProvider.tsx`: Theme application and switching
- `pages/UserSettingsPage/AppearancePage/AppearanceForm.tsx`: UI for theme selection
- `utils/themeGenerator.ts`: Custom theme generation utilities