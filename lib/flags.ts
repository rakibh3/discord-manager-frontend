import "server-only";

/**
 * Daily-status dashboard availability.
 *
 * The per-member daily status page, the seven overview counts, search/filter,
 * the member detail view and export are all written against the contract in
 * `API_INTEGRATION.md` §13 — but the backend exposes none of it over HTTP. The
 * aggregation lives in its repository layer only, so every one of those paths
 * would answer `API Not Found!`.
 *
 * While this is off the feature renders an explanatory unavailable state and
 * issues no request at all. It is deliberately *not* a client-visible flag:
 * nothing in the browser should be able to turn on a call to a route that does
 * not exist.
 *
 * Defaults to off. Only the exact string `"true"` enables it, so a stray
 * `DAILY_STATUS_ENABLED=false` or `=0` cannot switch it on by truthiness.
 */
export const DAILY_STATUS_ENABLED = process.env.DAILY_STATUS_ENABLED === "true";
