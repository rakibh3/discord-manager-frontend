import { redirect } from "next/navigation";

/** Roster engagement now lives on the Member status page, as its "Enrolled
 *  students" view — one status page instead of two. Kept as a redirect so
 *  bookmarks and shared links (query string included) still land correctly. */
export default async function RosterStatusRedirect({
  searchParams,
}: PageProps<"/dashboard/roster/status">) {
  const params = await searchParams;
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined) next.set(key, single);
  }

  next.set("view", "enrolled");
  redirect(`/dashboard/members?${next.toString()}`);
}
