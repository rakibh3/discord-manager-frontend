import { redirect } from "next/navigation";

/**
 * The app has no marketing surface. Admins belong on the dashboard; students
 * are linked straight to `/attendance` from Discord. `proxy.ts` turns this into
 * a redirect to `/login` when there is no session cookie.
 */
export default function RootPage() {
  redirect("/dashboard");
}
