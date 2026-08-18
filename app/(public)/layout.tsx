import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance",
  description: "Submit your daily attendance.",
};

/** Standalone layout for the public attendance homepage: no `requireSession()`,
 *  no dashboard shell, and `proxy.ts` does not match `/`. */
export default function AttendanceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center px-4 py-6 sm:py-10">
      <div className="my-auto w-full max-w-xl">{children}</div>
    </div>
  );
}
