import { AttendanceForm } from "./attendance-form";
import { dhakaToday, formatCivilDate } from "@/lib/dhaka-date";

/**
 * Rendered per request, not prerendered.
 *
 * The header shows today's Dhaka civil date. Statically prerendered, that date
 * would be frozen at build time and every student would be told the wrong day
 * from the second day onward.
 */
export const dynamic = "force-dynamic";

export default function AttendancePage() {
  // The Dhaka civil day, which is the day the backend files the row under —
  // not the browser's local date.
  const today = dhakaToday();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Daily Attendance
        </h1>
        <p className="text-muted-foreground text-sm">
          {formatCivilDate(today)} (Asia/Dhaka)
        </p>
      </header>

      <AttendanceForm />

      <p className="text-muted-foreground text-center text-xs">
        Attendance জমা দেওয়ার পর <code>#daily-update</code> চ্যানেলে আপনার
        আপডেটটিও পোস্ট করতে ভুলবেন না — দুটোই আলাদা।
      </p>
    </div>
  );
}
