## 1. Theme Provider Setup

- [x] 1.1 Create `components/theme-provider.tsx` client component wrapping `next-themes` `ThemeProvider` with default dark theme support.
- [x] 1.2 Update `app/layout.tsx` to include `ThemeProvider` and add `suppressHydrationWarning` to `<html>`.
- [x] 1.3 Update `components/ui/sonner.tsx` to integrate with `next-themes` for synchronized toast theme styling.

## 2. Theme Toggle Controls

- [x] 2.1 Create `components/dashboard/theme-toggle.tsx` providing an accessible theme toggle control (Dark / Light / System).
- [x] 2.2 Integrate the theme toggle in the desktop sidebar layout (`app/(dashboard)/dashboard/layout.tsx` and/or `components/dashboard/admin-identity.tsx`).
- [x] 2.3 Integrate the theme toggle in the mobile navigation header (`app/(dashboard)/dashboard/layout.tsx` / `components/dashboard/mobile-nav.tsx`).

## 3. Settings Appearance Page

- [x] 3.1 Create an Appearance settings card component (`components/dashboard/appearance-card.tsx` or within settings) with selectable theme options.
- [x] 3.2 Update `app/(dashboard)/dashboard/settings/page.tsx` to render the Appearance settings card.

## 4. Verification and Polishing

- [x] 4.1 Verify dark mode is applied by default on first visit.
- [x] 4.2 Verify smooth switching between dark, light, and system themes across all routes (dashboard, public attendance, login).
- [x] 4.3 Verify chart visualization tokens, cards, and toast notification contrast in both modes.
- [x] 4.4 Run lint, typecheck, and build validation (`bun run lint`, `bun run build`).
