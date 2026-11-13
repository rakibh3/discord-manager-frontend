## Context

The app serves two things from one origin: the public attendance form at `/`, which talks to the backend from the browser, and the admin dashboard, which talks to it from the Next server through `lib/api/client.ts` with an httpOnly session cookie.

Registration needs one of each: a public page for people with no account and no Discord membership yet, and an admin page.

## Goals / Non-Goals

**Goals**

- A registrant can complete the form on a phone and is told clearly what happened.
- A registrant who arrives outside the window sees why, and when to come back.
- An admin can open, close and schedule registration and see every registration's status.
- The dashboard never reports mail as working when it is not.

**Non-Goals**

- Live per-keystroke verification, as the attendance form has. Nothing about a registrant can be verified against the server yet.
- Editing or deleting a registration.

## Decisions

### The submit is browser-direct

The backend rate-limits the submit route per IP. A Server Action would send every registrant's request from the Next server's address, collapsing them into one shared budget. So the form posts to `NEXT_PUBLIC_API_BASE_URL` itself, as the attendance form does. The window read, which has no limiter, is done on the server while rendering.

### The window read fails open

`readRegistrationWindow()` returns `null` on any error and the page shows the form. The backend re-checks the window on every submit, so the worst case is one refused submit; failing closed would hide an open form behind a backend blip. Same rule as `getAttendanceWindow`.

### Outcomes are distinct, and "already registered" is not an error

201 replaces the form with a success card. 409 is shown as a success-toned notice, because for the person the address belongs to it is good news. 403 (window closed since the page loaded), 429 and network failures each get their own message. A failed submit moves focus to the message. Backend validation messages arrive title-cased, so field errors use the app's own copy keyed on the field.

### One settings form, saved explicitly

The settings card holds local form state and sends only the keys that changed. The status badge shows the stored state the backend computed, not the unsaved form, so it never says "Open" for a form nobody can reach yet. The window rules are checked in the browser with the same string comparison the backend uses, and again on the server.

### The settings read has no fallback

The registrations list falls back to an empty page on error, like the roster page. The settings read does not: an invented settings object would show empty dates, and saving from it would overwrite the real window. A failed settings read goes to the dashboard error boundary.

### Email actions explain why they are unavailable

When welcome emails are off, mail is unconfigured, or the queue is down, the resend and retry controls are disabled and the reason is written out next to them. The bulk retry is confirmed with the number of emails it will send; adding to the roster is not confirmed, because it is create-only.

### Export goes through a route handler

The CSV is a browser download and the access token must stay on the server, so `app/api/registrations/export/route.ts` streams the backend response through, carrying the filters on screen.

## Risks / Trade-offs

- **`RateLimit-Reset` is not readable cross-origin**, so the 429 message falls back to "a few minutes".
- **The window can change after the page renders.** The submit handles the resulting 403.
- **No link to `/register` from the attendance page**; the organisers share the URL.

## Migration Plan

Deploy after the backend change. The form is off by default, so `/register` shows the closed state until an admin switches it on.

## Open Questions

- Whether the attendance page should link to `/register` while registration is open.
