import type { Metadata } from "next";

import { PublicFooter } from "./_components/public-footer";
import { PublicHeader } from "./_components/public-header";

export const metadata: Metadata = {
  title: "Daily Attendance",
  description: "Submit your daily attendance and check in with your Discord cohort.",
};

/** Standalone public shell for `/` (Daily Attendance) and `/register` (Student
 *  Registration): no `requireSession()`, no dashboard shell, and `proxy.ts`
 *  deliberately excludes both routes so students can reach them without logging in. */
export default function PublicPortalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="public-grid-canvas flex min-h-svh flex-col">
      <PublicHeader />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10"
      >
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
