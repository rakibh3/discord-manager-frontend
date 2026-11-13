## 1. Types, validation and endpoints

- [x] 1.1 Add the registration types to `lib/api/types.ts` (window, submit payload, `Registration`, `RegistrationSettings`, the settings patch, the query, and the two action results).
- [x] 1.2 Create `lib/validation/registration.ts`: `normalizeBdPhone`, `registrationSchema`, the per-field copy, `validateRegistrationWindow` and `validateInviteUrl`; cover them in `registration.test.ts`.
- [x] 1.3 Create `lib/api/endpoints/registration.ts`: the anonymous window read, the settings read and patch, the listing, add-to-roster, resend, bulk retry, and `registrationsExportPath`; cover them in `registration.test.ts` without mocking `@/lib/auth/session`.
- [x] 1.4 Create `lib/registration-window.ts` with a fail-open `readRegistrationWindow()`.

## 2. Public page

- [x] 2.1 Create `app/(public)/register/page.tsx`, rendered per request, choosing between the form and the closed state.
- [x] 2.2 Create `registration-closed.tsx` covering switched off, not yet open (with the opening time) and closed (with the closing time).
- [x] 2.3 Create `registration-form.tsx`: four labelled fields, browser validation, a browser-direct submit, and distinct outcomes for 201, 409, 403, 429, field-level 400 and network failure, with focus moved to the message on failure.

## 3. Dashboard page

- [x] 3.1 Create `actions/registration.ts`: save settings, add to roster, resend one email, retry unsent emails.
- [x] 3.2 Create `app/(dashboard)/dashboard/registration/page.tsx` reading settings (no fallback) and the filtered listing.
- [x] 3.3 Create `settings-card.tsx`: the switch, the window inputs with a clear action per end, the two toggles, the invite link, mail and queue warnings, the counts line, and a save that sends only changed keys.
- [x] 3.4 Create `registrations-table.tsx`: filters, search, the table with roster and email status, per-row actions, the bulk actions with a confirmed retry, the export link, and paging.
- [x] 3.5 Create `app/api/registrations/export/route.ts` to stream the CSV through with the session token.
- [x] 3.6 Add the "Registration" item to `components/dashboard/nav-items.ts`.

## 4. Verification

- [x] 4.1 `bun test`, `bun run lint` and `bun run build` pass.
- [x] 4.2 In a browser: empty and malformed submits show field errors; a valid submit shows the success card; a repeat shows "Already registered"; an exhausted budget shows the rate-limited message with the typed values kept.
- [x] 4.3 In a browser: the dashboard page shows the stored state, the mail warning and the registration row; an invalid window is refused before saving; a valid change saves; filters and the CSV export work.
- [ ] 4.4 Check the closed, not-yet-open and success states visually on a phone-width viewport in light and dark themes.

## 5. Documentation

- [x] 5.1 `AGENTS.md`: `/register`, and why its submit stays browser-direct.
- [x] 5.2 Mirror `API_INTEGRATION.md`, `postman-collection.json` and `PRD.md` from the backend package.
