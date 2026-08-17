import { Construction } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * What the Status page shows while `DAILY_STATUS_ENABLED` is off.
 *
 * Deliberately contains **no numbers at all** — not a zero, not a placeholder,
 * not a greyed-out sample. A "0%" or a dimmed chart with plausible-looking bars
 * is exactly how a fabricated attendance figure ends up in a screenshot that
 * someone treats as real. An empty explanation is more useful than a
 * convincing lie.
 *
 * No request is issued from this path either, so the backend never sees a call
 * to a route that does not exist and no `API Not Found!` appears in its logs.
 */
export function DailyStatusUnavailable() {
  return (
    <div className="flex flex-col gap-4">
      <Alert variant="warning">
        <Construction />
        <AlertTitle>This page is waiting on the backend</AlertTitle>
        <AlertDescription>
          The per-member daily status view is built and ready, but the backend
          does not expose it yet. The aggregation exists in its repository layer
          (<code className="font-mono text-xs">getDailyStatusPage</code> and{" "}
          <code className="font-mono text-xs">getDailyStatusCounts</code>) and is
          tested there, but no HTTP route serves it — so there is nothing to
          read.
          <br />
          <br />
          Nothing is shown here rather than sample figures, because a
          placeholder percentage on an attendance dashboard is indistinguishable
          from a real one once it is screenshotted.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>What will appear here</CardTitle>
          <CardDescription>
            The moment the backend ships those routes, setting{" "}
            <code className="font-mono text-xs">DAILY_STATUS_ENABLED=true</code>{" "}
            turns all of this on with no further frontend work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground flex list-disc flex-col gap-1.5 pl-5 text-sm">
            <li>
              The seven overview counts for a chosen day — total members,
              attendance submitted, daily update submitted, both complete,
              missing update only, missing attendance only, and missing both.
            </li>
            <li>
              A part-to-whole breakdown of the four statuses, plus a trend across
              recent days.
            </li>
            <li>
              A searchable, filterable member table paginated on the server, with
              the selected date reflected in the URL so a view can be shared.
            </li>
            <li>
              A per-member detail view showing contact details, the attendance
              time and that day&rsquo;s Discord messages, in Asia/Dhaka.
            </li>
            <li>CSV and Excel export of whatever is currently filtered.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>In the meantime</CardTitle>
          <CardDescription>
            These pages are driven entirely by data that does exist today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground flex list-disc flex-col gap-1.5 pl-5 text-sm">
            <li>
              <strong>Reminders</strong> shows who is missing an update for a
              given date — the target preview is the same query the send uses.
            </li>
            <li>
              <strong>Discord</strong> shows the member directory and whether
              daily-update ingestion is actually recording anything.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
