import { AttendanceForm } from "./attendance-form";
import { WindowClosed } from "./window-closed";
import { getAttendanceWindow } from "@/lib/attendance-window";
import { dhakaToday, formatCivilDate } from "@/lib/dhaka-date";

/** Rendered per request: the header shows today's Dhaka date, and the submission
 *  window turns over on a wall clock, so neither may be prerendered. */
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  // The Dhaka civil day, which is the day the backend files the row under —
  // not the browser's local date.
  const today = dhakaToday();

  // `null` means the window could not be determined, which falls through to the
  // form — `POST /attendance/submit` is where the real checks live.
  const attendanceWindow = await getAttendanceWindow();
  const closed = attendanceWindow !== null && !attendanceWindow.isOpen;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Daily Attendance
        </h1>
        <p className="text-muted-foreground text-base">
          {formatCivilDate(today)} (Asia/Dhaka)
        </p>
      </header>

      {closed ? (
        <WindowClosed attendanceWindow={attendanceWindow} />
      ) : (
        <AttendanceForm
          emailVerificationRequired={
            attendanceWindow?.emailVerificationRequired ?? false
          }
        />
      )}

      {/* Only meaningful next to a form the student can actually submit — after
          a "come back later" card it would be advice about the wrong problem. */}
      {closed ? null : (
        <p className="text-muted-foreground text-center text-xs">
          After submitting attendance, don&apos;t forget to post your update
          in the <code>#daily-update</code> channel — they are two separate
          things.
        </p>
      )}
    </div>
  );
}
