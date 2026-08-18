import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance",
  description: "Submit your daily attendance.",
};

/**
 * Standalone layout for the homepage, which is the public attendance form.
 *
 * Deliberately no `requireSession()`, no dashboard shell and no navigation:
 * students are not `users` rows and have no credential to present. `proxy.ts`
 * does not match `/` either, so the page is reachable identically whether or
 * not an admin session cookie happens to be in the browser.
 */
export default function AttendanceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center px-4 py-6 sm:py-10">
      <div className="my-auto w-full max-w-xl">{children}</div>
    </div>
  );
}
