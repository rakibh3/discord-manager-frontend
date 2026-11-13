## Why

The backend now accepts public registrations inside an admin-set window, adds them to the enrolment roster, and sends a welcome email (backend change `add-registration-form`). Nothing in the frontend reaches it: a prospective student has no page to register on, and an admin has no screen to open or close registration or to see who signed up.

## What Changes

- Add a **public registration page** at `/register`: name, email, phone and Discord username, validated in the browser with the backend's rules, submitted browser-direct. Outside the window it shows a closed state that says when registration opens or that it has ended.
- Add a **dashboard page** at `/dashboard/registration`: a settings card (on/off switch, opening and closing date and time, automatic roster enrolment, welcome email switch, Discord invite link) and a registrations table (roster status, welcome-email status with its failure reason, search and filters).
- Add **admin actions**: add one or all pending registrations to the roster, resend one welcome email, retry all unsent emails, and export the filtered list as CSV.
- Surface **mail and queue health** on the dashboard: when the backend cannot send mail, when sandbox mode is diverting it, and when the queue is unavailable.
- Add a **sidebar item** under "Members & Roster".

Not in scope: a link to `/register` from the attendance page, and any change to the attendance form.

## Capabilities

### New Capabilities

- `registration-ui`: the public registration page and its states, and the dashboard page for the window, the registrations list and its actions.

### Modified Capabilities

None.

## Impact

- **New routes**: `app/(public)/register/`, `app/(dashboard)/dashboard/registration/`, `app/api/registrations/export/route.ts`.
- **New code**: `lib/api/endpoints/registration.ts` (+ test), `lib/validation/registration.ts` (+ test), `lib/registration-window.ts`, `actions/registration.ts`.
- **Touched code**: `lib/api/types.ts` (registration types), `components/dashboard/nav-items.ts`.
- **Config**: none new. `/register` uses the existing `NEXT_PUBLIC_API_BASE_URL`, and this origin must already be in the backend's CORS allowlist for the attendance form.
- **Docs**: `AGENTS.md`, `API_INTEGRATION.md` §8.6B and §9, `postman-collection.json`, `PRD.md` §17.
