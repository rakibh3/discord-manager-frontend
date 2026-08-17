/**
 * One `ApiError` for the backend's five different error shapes.
 *
 * `globalErrorHandler.ts` is a single formatter but its branches emit different
 * bodies (`API_INTEGRATION.md` §3):
 *
 *   3a Zod validation  → 400, `errorDetails.issues[]`, every word Title Cased
 *   3b AppError        → its own status, human-written `message`
 *   3c Prisma P2002    → 409, useful text in **`errorMessage`**, not `message`
 *   3d Prisma P2025    → 404, same — and this is what an unknown login email is
 *   3e Auth middleware → 401/403 written directly, bypassing the handler
 *   3f Unknown route   → 404 `API Not Found!`
 *   3g Expired JWT     → **HTTP 500**, `message: "jwt expired"`
 *
 * No error body contains `statusCode` and none contains `data`, so the HTTP
 * status is the only reliable source for the code.
 *
 * Not `server-only`: the attendance form calls the backend browser-direct and
 * needs the same normalization. Nothing here touches a token.
 */

export type FieldIssue = { path: string; message: string };

/**
 * An expired or malformed access token comes back as **HTTP 500** because
 * `auth.ts` hands the token to `jwt.verify` directly and a `TokenExpiredError`
 * carries no `statusCode`. Keying refresh on 401 alone means a 500 error page
 * every single time a token ages out.
 */
const EXPIRED_JWT_MESSAGES = new Set([
  "jwt expired",
  "invalid signature",
  "jwt malformed",
  "invalid token",
]);

/**
 * Zod paths arrive Title Cased (`DiscordUsername`), so only the first character
 * needs lowering to match a form field name.
 */
const lowerFirst = (value: string): string =>
  value.charAt(0).toLowerCase() + value.slice(1);

export class ApiError extends Error {
  readonly status: number;
  readonly issues: FieldIssue[];
  readonly body: unknown;

  constructor(
    status: number,
    message: string,
    issues: FieldIssue[] = [],
    body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
    this.body = body;
  }

  /** Zod rejected the payload. Render `issues` against your own field labels. */
  get isValidation(): boolean {
    return this.status === 400 && this.issues.length > 0;
  }

  /**
   * The access token needs refreshing. Note the 500 branch — see the constant
   * above for why that is not a bug in this check.
   */
  get isAuthExpired(): boolean {
    return (
      this.status === 401 ||
      (this.status === 500 && EXPIRED_JWT_MESSAGES.has(this.message))
    );
  }

  /** The request never reached the backend (DNS, refused connection, timeout). */
  get isNetwork(): boolean {
    return this.status === 0;
  }

  /**
   * Field-keyed map for `useActionState` / react-hook-form.
   *
   * The values are the *server's* text, which is Title Cased word by word and
   * reads wrong in polished UI — callers should map these keys to their own
   * copy and fall back to the server string only for fields they don't know
   * about, so an unmapped issue is never silently swallowed.
   */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(
      this.issues.map((issue) => [lowerFirst(issue.path), issue.message]),
    );
  }
}

type ErrorBody = {
  message?: unknown;
  errorMessage?: unknown;
  errorDetails?: { issues?: unknown } | unknown;
};

/** Generic labels that mean nothing to a user — prefer `errorMessage` over these. */
const GENERIC_MESSAGES = new Set([
  "Duplicate Error",
  "Record not found",
  "Validation Error",
  "Something went wrong!",
  "Something went wrong",
]);

function readIssues(body: ErrorBody | null): FieldIssue[] {
  const details = body?.errorDetails;
  if (!details || typeof details !== "object") return [];
  const issues = (details as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];

  return issues.flatMap((issue): FieldIssue[] => {
    if (!issue || typeof issue !== "object") return [];
    const { path, message } = issue as { path?: unknown; message?: unknown };
    if (typeof path !== "string" || typeof message !== "string") return [];
    return [{ path, message }];
  });
}

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

/** Collapses all five backend error shapes into one `ApiError`. */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorBody | null = null;
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    // Non-JSON body — a proxy error page, an empty 502, a truncated response.
  }

  const issues = readIssues(body);
  const message = asString(body?.message);
  const errorMessage = asString(body?.errorMessage);

  // Order matters. On the Zod branch `message` is the joined string and the
  // per-field text lives in `issues`. On the Prisma branches `message` is a
  // generic label ("Duplicate Error") and the real text is in `errorMessage`.
  const resolved =
    (issues.length > 0
      ? issues.map((issue) => issue.message).join(", ")
      : null) ??
    (message && !GENERIC_MESSAGES.has(message) ? message : null) ??
    errorMessage ??
    message ??
    `Request failed with status ${response.status}`;

  return new ApiError(response.status, resolved, issues, body);
}

/**
 * A request that never got a response. Status 0 keeps it out of every
 * status-based branch — in particular it must never look like `isAuthExpired`,
 * which would log a user out because their wifi dropped.
 */
export function toNetworkError(cause: unknown): ApiError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new ApiError(
    0,
    `Could not reach the API (${detail}).`,
    [],
    { cause: detail },
  );
}
