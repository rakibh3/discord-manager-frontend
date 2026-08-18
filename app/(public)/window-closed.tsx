import { CalendarClock, Clock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttendanceWindow } from "@/lib/api/types";
import { formatDhaka, formatWallClock } from "@/lib/dhaka-date";
import { formatWeekdays } from "@/lib/validation/schedule";

/**
 * What a student sees outside the submission attendanceWindow.
 *
 * The requirement this satisfies is "a meaningful message, not a 404". A 404
 * says the page is wrong; the truth is that the page is right and the *time* is
 * wrong, so the copy leads with when to come back and states the hours plainly.
 *
 * Bilingual for the same reason the form is: the students reading this are
 * Bangla-first, and "closed" is precisely the message that must not be
 * misread as "broken".
 */
export function WindowClosed({
  attendanceWindow,
}: {
  attendanceWindow: AttendanceWindow;
}) {
  // A disabled schedule is a different situation from "outside today's hours":
  // there is no next opening to name, so promising one would be a lie.
  const paused = !attendanceWindow.enabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock aria-hidden className="size-6" />
          {paused ? "Attendance is paused" : "Attendance is closed right now"}
        </CardTitle>
        <CardDescription className="text-base">
          {paused
            ? "এই মুহূর্তে attendance নেওয়া বন্ধ রাখা হয়েছে।"
            : "এখন attendance জমা দেওয়ার সময় নয়। নির্দিষ্ট সময়ে আবার আসুন।"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-base">
        {paused ? (
          <p className="text-muted-foreground">
            An admin has turned the daily attendance window off. It will be
            announced in Discord when it starts again — there is nothing you
            need to do in the meantime.
          </p>
        ) : (
          <>
            <div className="bg-muted/60 flex flex-col gap-1 rounded-md p-3">
              <p className="flex items-center gap-2 font-medium">
                <CalendarClock aria-hidden className="size-5" />
                Open daily from {formatWallClock(attendanceWindow.openTime)} to{" "}
                {formatWallClock(attendanceWindow.closeTime)}
              </p>
              <p className="text-muted-foreground text-sm">
                {formatWeekdays(attendanceWindow.daysOfWeek)} · all times Asia/Dhaka
              </p>
            </div>

            {attendanceWindow.nextOpenAt ? (
              <p>
                <span className="text-muted-foreground">Opens next:</span>{" "}
                <strong>{formatDhaka(attendanceWindow.nextOpenAt)}</strong>
              </p>
            ) : null}

            <p className="text-muted-foreground">
              প্রতিদিন <strong>{formatWallClock(attendanceWindow.openTime)}</strong> থেকে{" "}
              <strong>{formatWallClock(attendanceWindow.closeTime)}</strong> পর্যন্ত attendance জমা দেওয়া
              যাবে। এই সময়ের বাইরে ফর্মটি বন্ধ থাকে।
            </p>
          </>
        )}

        <p className="text-muted-foreground border-t pt-3 text-sm">
          Attendance এবং <code>#daily-update</code> আলাদা — দুটোই একই সময়ের
          মধ্যে করতে হবে। কিছু নিয়ে কনফিউজান থাকলে Discord সার্ভারে জানান।
        </p>
      </CardContent>
    </Card>
  );
}
