/** One `ApiError` for the backend's five error shapes (`API_INTEGRATION.md` §3).
 *  HTTP status is the only reliable code source. Not `server-only` by design. */

export type FieldIssue = { path: string; message: string };

/** An expired or malformed access token comes back as **HTTP 500**, not 401 —
 *  `auth.ts` hands it to `jwt.verify` and `TokenExpiredError` carries no status. */
const EXPIRED_JWT_MESSAGES = new Set([
  "jwt expired",
  "invalid signature",
  "jwt malformed",
  "invalid token",
]);

/** Zod paths arrive Title Cased (`DiscordUsername`), so only the first character
 *  needs lowering to match a form field name. */
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

  /** The access token needs refreshing — see `EXPIRED_JWT_MESSAGES` for the 500,
   *  or P2025 404 when the user in the JWT was removed from the database. */
  get isAuthExpired(): boolean {
    const isPrismaUserNotFound =
      this.status === 404 &&
      (this.message === "The requested record does not exist." ||
        this.message === "Record not found") &&
      (this.body as { errorDetails?: { code?: string } } | undefined)
        ?.errorDetails?.code === "P2025";

    return (
      this.status === 401 ||
      (this.status === 500 && EXPIRED_JWT_MESSAGES.has(this.message)) ||
      isPrismaUserNotFound
    );
  }

  /** The request never reached the backend (DNS, refused connection, timeout). */
  get isNetwork(): boolean {
    return this.status === 0;
  }

  /** Field-keyed map for `useActionState` / react-hook-form. The values are the
   *  server's Title Cased text; callers should map these keys to their own copy. */
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

  // Order matters: on the Zod branch the per-field text is in `issues`, while on
  // the Prisma branches `message` is a label and the text is `errorMessage`.
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

/** A request that never got a response. Status 0 keeps it out of every
 *  status-based branch, especially `isAuthExpired`. */
export function toNetworkError(cause: unknown): ApiError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new ApiError(
    0,
    `Could not reach the API (${detail}).`,
    [],
    { cause: detail },
  );
}
