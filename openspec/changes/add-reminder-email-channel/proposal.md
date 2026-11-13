## Why

The backend can now send reminders by email as well as Discord DM, tracks delivery and opens through a Mailtrap webhook, links registered students to their Discord account when they join, and no longer has a roster spreadsheet import. The dashboard needs to expose all of it, and the two near-duplicate status pages should become one.

## What Changes

- **Reminder composer**: a "Send by" choice (Discord DM, Email, both; Discord by default). The preview shows how many people an email can reach and how many never registered. The confirmation names the channels. Email is disabled, with the reason, while reminder mail is unconfigured.
- **Email log** (`/dashboard/reminders/emails`, new nav entry): state chips with counts (Delivered, Opened, Not opened yet, Awaiting delivery, Bounced, Failed, Queued, Not registered), broadcast / sent-date / search filters held in the URL, paginated table, per-email tracking history, and **Export to Excel** through `app/api/reminders/emails/export/route.ts`. Copy states plainly that opens are estimates.
- **Broadcast detail**: channels badge, progress across both channels, an email panel (delivered, opened, not opened, bounced/failed, not registered, open rate) linking to the filtered log. History shows channels.
- **Queue health**: email worker and sender, plus warnings when email is unconfigured, the webhook secret is missing, or emails were sent but no tracking event ever arrived.
- **Registrations**: a "Linked / Not joined Discord" badge per registration.
- **One status page**: Member Status gains a "Discord members / Enrolled students" switch; the enrolled view is the former Roster Engagement page (components moved to `members/_enrolled/`). `/dashboard/roster/status` redirects there with its query string. "Never linked" reads "Not joined Discord".
- **Roster**: the import button, import dialog and import-history tab are removed; registration is the only way onto the roster.

## Impact

- `lib/api/types.ts`, `lib/api/endpoints/reminders.ts` (+ new `reminders.test.ts`), `lib/api/endpoints/roster.ts` (+ test), `actions/reminders.ts`, `actions/roster.ts`, `lib/reminder-labels.ts`, `components/dashboard/nav-items.ts`.
- Removed: `roster/import-dialog.tsx`, `roster/import-history-table.tsx`, `roster/outcome-tile.tsx`.
