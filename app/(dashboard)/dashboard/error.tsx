"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Every failure in this segment lands here, and almost all of them are one of
 * two things: the backend is not running, or a specific endpoint returned an
 * error. Both deserve a sentence an admin can act on — a stack trace tells them
 * nothing, and a bare "Something went wrong" tells them less.
 *
 * The API base URL is server-only, so it cannot be named from a client
 * component. `lib/api/client.ts` puts it into the message for a transport
 * failure instead, which is where it is actually useful.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard segment error:", error);
  }, [error]);

  const unreachable =
    error.message.includes("Could not reach the API") ||
    error.message.includes("API_BASE_URL is not set");

  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>
        {unreachable
          ? "The backend API could not be reached"
          : "This page could not be loaded"}
      </AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>
          {unreachable ? (
            <>
              The dashboard is running, but the API behind it did not answer.
              Check that the backend is up and that <code>API_BASE_URL</code> in{" "}
              <code>.env.local</code> points at it. Details:{" "}
              <em>{error.message}</em>
            </>
          ) : (
            <>
              The request failed and no data is shown rather than partial or
              stale data. Details: <em>{error.message}</em>
            </>
          )}
        </span>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw data-icon="inline-start" />
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
