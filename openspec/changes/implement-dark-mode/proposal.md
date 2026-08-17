## Why

The Discord Manager web application has dark mode color tokens defined in `globals.css` and `next-themes` in `package.json`, but currently lacks active theme provider integration and user-accessible toggle controls. Setting dark mode as the default theme and enabling users to toggle between dark and light modes provides a comfortable, high-contrast, eye-friendly interface for admins managing operations and students submitting attendance.

## What Changes

- **Theme Provider Integration**: Integrate `next-themes` with a `ThemeProvider` client component in `app/layout.tsx`, configured with `defaultTheme="dark"`, `attribute="class"`, and `enableSystem={true}`.
- **Hydration Safety**: Add `suppressHydrationWarning` to `html` in `app/layout.tsx` to prevent hydration mismatches during theme hydration.
- **Theme Toggle UI**: Add theme toggle components (quick toggle in sidebar/mobile header and appearance options in settings).
- **Appearance Settings**: Provide a theme selection card in the admin Settings page (`/dashboard/settings`) allowing explicit selection between Dark, Light, and System themes.
- **Component & Toast Theming**: Verify and ensure proper dark/light mode rendering across charts, cards, sonner toasts, and public attendance pages.

## Capabilities

### New Capabilities
- `theme-management`: Theme provider integration, default dark mode behavior, theme persistence in local storage, and interactive theme toggle controls across the dashboard shell and settings.

### Modified Capabilities
<!-- None -->

## Impact

- **Affected Files**:
  - `app/layout.tsx`: Incorporate `ThemeProvider` and `suppressHydrationWarning`.
  - `components/theme-provider.tsx`: New client component wrapping `next-themes`.
  - `components/theme-toggle.tsx`: New theme toggle switch / dropdown component.
  - `app/(dashboard)/dashboard/layout.tsx`: Add theme toggle to desktop sidebar and mobile header.
  - `app/(dashboard)/dashboard/settings/page.tsx`: Add appearance settings card.
  - `components/ui/sonner.tsx`: Bind toaster theme to `next-themes` theme context.
- **Dependencies**: Uses already installed `next-themes` and `lucide-react`. No new npm packages required.
- **APIs**: No backend API changes required; theme preference is stored clientside via `next-themes` (localStorage).
