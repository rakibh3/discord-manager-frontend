import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance",
  description: "Submit your daily attendance.",
};

/**
 * Standalone layout for the public form.
 *
 * Deliberately no `requireSession()`, no dashboard shell and no navigation:
 * students are not `users` rows and have no credential to present. `proxy.ts`
 * does not match this path either, so the page is reachable identically whether
 * or not an admin session cookie happens to be in the browser.
 */
export default function AttendanceLayout({
  children,
}: LayoutProps<"/attendance">) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
