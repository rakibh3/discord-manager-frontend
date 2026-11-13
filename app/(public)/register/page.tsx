import type { Metadata } from "next";

import { RegistrationClosed } from "./registration-closed";
import { RegistrationForm } from "./registration-form";
import { readRegistrationWindow } from "@/lib/registration-window";

export const metadata: Metadata = {
  title: "Registration",
  description: "Register for the program.",
};

/** Rendered per request: whether the form is open turns over on a wall clock
 *  and on an admin's switch, so it may not be prerendered. */
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // `null` means the window could not be determined, which falls through to
  // the form — `POST /registration/submit` is where the real check lives.
  const registrationWindow = await readRegistrationWindow();
  const closed = registrationWindow !== null && !registrationWindow.isOpen;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Registration</h1>
        <p className="text-muted-foreground text-base">
          Sign up once. We&apos;ll email you the next steps.
        </p>
      </header>

      {closed ? (
        <RegistrationClosed registrationWindow={registrationWindow} />
      ) : (
        <RegistrationForm closesAt={registrationWindow?.closesAt ?? null} />
      )}
    </div>
  );
}
