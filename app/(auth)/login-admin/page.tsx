import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  // The admin entry point is unlisted by design; keeping it out of search
  // indexes is the other half of that.
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Discord Manager
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to the admin console.
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
