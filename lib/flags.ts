import "server-only";

/**
 * Daily-status dashboard availability.
 *
 * The per-member daily status page, the seven overview counts, search/filter,
 * the member detail view and export are fully documented and integrated per
 * `API_INTEGRATION.md` §8.8 and `postman-collection.json`.
 *
 * Enabled by default. Set `DAILY_STATUS_ENABLED=false` if explicitly needed.
 */
export const DAILY_STATUS_ENABLED = process.env.DAILY_STATUS_ENABLED !== "false";
