## Context

The Discord Manager frontend is built with Next.js 16 (App Router), Tailwind CSS v4, and shadcn/ui components. The stylesheet `app/globals.css` already contains comprehensive color token mappings for both `:root` (light) and `.dark` (dark), including semantic tokens for background, foreground, cards, sidebars, charts, and touch targets. The `next-themes` library is already present in `package.json` dependencies.

However, `app/layout.tsx` does not currently include a `ThemeProvider`, and there are no UI controls (buttons, toggles, or settings options) for users to toggle or manage their active theme.

## Goals / Non-Goals

**Goals:**
- Provide a robust `ThemeProvider` setup that sets `dark` mode as default on initial launch.
- Enable smooth switching between dark, light, and system themes.
- Provide responsive theme toggle controls in the dashboard sidebar, mobile header, and settings page.
- Prevent Flash of Unstyled Content (FOUC) and React hydration mismatch warnings.
- Keep toasts (`sonner`) and chart colors seamlessly styled in both modes.

**Non-Goals:**
- Custom per-user server-stored theme preferences in database (storing preference in `localStorage` via `next-themes` is sufficient and avoids layout shifts / blocking SSR).
- Multi-color custom themes beyond Dark, Light, and System.

## Decisions

### Decision 1: Use `next-themes` for Theme Management
- **Rationale**: `next-themes` is the industry standard for Next.js App Router applications. It handles `<html>` class injection (`.dark`), SSR hydration safety via an injected inline script, `prefers-color-scheme` media query listeners, and local storage persistence without extra boilerplate.
- **Alternatives considered**:
  - *Custom React Context with cookie storage*: Requires manual cookie parsing in layout/middleware and custom script injection to prevent FOUC. Adds needless complexity when `next-themes` is already installed.
  - *CSS-only `prefers-color-scheme`*: Does not allow manual user toggling.

### Decision 2: ThemeProvider Configuration
- `attribute="class"`: Toggles `.dark` class on the `<html>` element, which matches `@custom-variant dark (&:is(.dark *))` and `.dark { ... }` defined in `globals.css`.
- `defaultTheme="dark"`: Satisfies the requirement that dark mode is the default.
- `enableSystem={true}`: Allows users who choose "System" to follow OS preferences.
- `disableTransitionOnChange={false}`: Provides clean visual transitions between themes.
- `suppressHydrationWarning` on `<html>`: Recommended by `next-themes` to suppress client-server class attribute divergence before hydration.

### Decision 3: Placement of Theme Controls
- **Sidebar & Header**: A compact toggle button or dropdown next to the user profile / logout button in the desktop sidebar and mobile navigation header for one-click access anywhere in the dashboard.
- **Settings Page (`/dashboard/settings`)**: An "Appearance" card offering explicit segmented controls or radio cards for "Dark", "Light", and "System".

### Decision 4: Client vs Server Boundary
- Create `components/theme-provider.tsx` with `"use client"` wrapping `ThemeProvider` from `next-themes`.
- Create `components/theme-toggle.tsx` with `"use client"` for user interactions with `useTheme()`.
- Keep `app/layout.tsx` and `app/(dashboard)/dashboard/layout.tsx` as Server Components.

## Risks / Trade-offs

- **[Risk] Hydration Flash or Mismatch**: When the client theme resolves from `localStorage`, server-rendered HTML might initially differ.
  - *Mitigation*: Add `suppressHydrationWarning` to `<html>` tag in `app/layout.tsx` and use `next-themes` built-in script injection. Ensure theme toggles check `mounted` state before rendering active icons to avoid SSR mismatch.
- **[Risk] Chart/Sonner Theming**: Charts using fixed HSL/OKLCH variables or Toaster might not automatically re-render theme colors.
  - *Mitigation*: Wire `useTheme()` into `<Toaster />` from `components/ui/sonner.tsx` so toasts automatically receive `theme="system" | "dark" | "light"`. Verify that chart CSS variables in `globals.css` properly resolve under `.dark`.
