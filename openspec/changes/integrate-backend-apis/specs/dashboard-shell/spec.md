## ADDED Requirements

### Requirement: Authenticated app shell

The dashboard SHALL render inside a persistent shell providing primary navigation to Overview, Discord, Schedule, Reminders and Settings, the signed-in admin's identity, and a logout control. The shell SHALL mark the current section for both sighted and assistive-technology users.

#### Scenario: Current section is indicated

- **WHEN** the admin is on the Reminders section
- **THEN** its navigation item is visually distinguished
- **AND** carries `aria-current="page"`

#### Scenario: Narrow viewport

- **WHEN** the viewport is under the mobile breakpoint
- **THEN** navigation collapses into a toggle that is reachable by keyboard, traps focus while open, and closes on `Escape`
- **AND** no horizontal page scroll is introduced at any width from 320 px upward

### Requirement: Slow reads never block the shell

Every authenticated read touches cookies, which blocks the segment's `loading.tsx`. Each independently-loading region SHALL therefore be wrapped in its own `<Suspense>` boundary with a skeleton that reserves the final layout's space.

#### Scenario: One slow panel

- **WHEN** the queue-health read is slow and the history read is fast
- **THEN** the history renders immediately while queue health shows its skeleton
- **AND** no layout shift occurs when the slow panel resolves

### Requirement: Error boundaries are actionable

Route segments SHALL provide error boundaries that state what failed and offer a retry, rather than surfacing a stack trace or a blank screen. A failure in one panel SHALL NOT blank the whole page.

#### Scenario: A panel's request fails

- **WHEN** the Discord status read throws
- **THEN** that panel shows an error with a retry control
- **AND** the rest of the dashboard remains usable

#### Scenario: Backend unreachable

- **WHEN** the backend cannot be reached at all
- **THEN** the message says the API is unreachable and names the configured base URL, rather than showing a generic failure

### Requirement: Design system and chart theming

All UI SHALL be built from the shadcn/ui primitives installed in this repo and SHALL draw color from semantic tokens; raw hex values SHALL NOT appear in components. Every chart SHALL come from the `@bklit` registry, composed root → grid → series → axes → tooltip, and SHALL take its colors from `chartCssVars` / the `--chart-*` variables rather than one-off literals.

#### Scenario: A new chart is added

- **WHEN** a chart is needed on any dashboard page
- **THEN** it is installed from the `@bklit` registry rather than hand-rolled as SVG or a third charting library
- **AND** its series colors come from the shared chart tokens

#### Scenario: Chart conveys status

- **WHEN** a chart encodes delivery outcomes
- **THEN** each series is distinguishable by label and tooltip, not by color alone
- **AND** every chart has an accessible text alternative stating the same figures

### Requirement: Accessibility baseline

The interface SHALL meet WCAG 2.1 AA for the flows in this change: text contrast of at least 4.5:1, visible focus indicators on every interactive element, keyboard operability throughout, interactive targets of at least 44×44 px, and form errors associated with their inputs.

#### Scenario: Keyboard-only operation

- **WHEN** an admin navigates with the keyboard alone
- **THEN** every control including dialogs, tabs, menus and pagination is reachable and operable
- **AND** focus is never trapped except intentionally inside an open dialog

#### Scenario: Status updates are announced

- **WHEN** an asynchronous result appears, such as a verification badge or a broadcast progress update
- **THEN** it is exposed through a polite live region rather than only visually

#### Scenario: Reduced motion

- **WHEN** the viewer has `prefers-reduced-motion` set
- **THEN** chart entrance animations and transitions are suppressed or reduced to a fade
