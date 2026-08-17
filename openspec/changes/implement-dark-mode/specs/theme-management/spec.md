## ADDED Requirements

### Requirement: Default Dark Theme
The application SHALL apply the dark theme as the default theme when no stored user theme preference exists.

#### Scenario: First-time visitor renders dark theme
- **WHEN** a user loads the application for the first time without a prior saved theme preference in browser storage
- **THEN** the root `<html>` element receives the `dark` class and the UI renders using dark mode color tokens.

### Requirement: Interactive Theme Switching
The application SHALL provide interactive theme toggle controls allowing users to switch between dark, light, and system themes.

#### Scenario: User toggles from dark to light mode
- **WHEN** a user clicks the theme toggle control while in dark mode
- **THEN** the theme updates to light mode, the `dark` class is removed from `<html>`, and the preference is saved.

#### Scenario: User toggles from light to dark mode
- **WHEN** a user clicks the theme toggle control while in light mode
- **THEN** the theme updates to dark mode, the `dark` class is added to `<html>`, and the preference is saved.

### Requirement: Theme Preference Persistence
The application SHALL persist the user's theme selection across page reloads and client navigation.

#### Scenario: Preserving theme across navigation and reload
- **WHEN** a user selects a preferred theme and reloads the page or navigates to another route
- **THEN** the selected theme remains active without causing visual hydration mismatch warnings.

### Requirement: Appearance Settings Management
The application SHALL provide an Appearance section in the Settings page (`/dashboard/settings`) allowing explicit selection of Dark, Light, or System themes.

#### Scenario: Admin selects system theme in settings
- **WHEN** an admin selects the "System" option on the Appearance settings card
- **THEN** the theme automatically synchronizes with the operating system's color scheme preference.

#### Scenario: Admin selects explicit theme in settings
- **WHEN** an admin selects "Dark" or "Light" in the Appearance settings card
- **THEN** the chosen theme is applied immediately and persists across sessions.

### Requirement: Toast and Component Theme Synchronization
The application SHALL ensure toast notifications, modals, and charts align with the currently active theme.

#### Scenario: Toaster adapts to theme changes
- **WHEN** toast notifications are rendered via Sonner
- **THEN** the toaster container adapts its visual style according to the active theme context.
