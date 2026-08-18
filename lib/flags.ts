import "server-only";

/** Daily-status dashboard availability. Enabled by default; set
 *  `DAILY_STATUS_ENABLED=false` to turn it off. */
export const DAILY_STATUS_ENABLED = process.env.DAILY_STATUS_ENABLED !== "false";
