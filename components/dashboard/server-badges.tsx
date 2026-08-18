import { Badge } from "@/components/ui/badge";
import type { ServerRef } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Which servers a person is in. One row is one **person**, not one membership,
 *  so this is the only place the server split is visible on a list row.
 *
 *  `serverCount` is never narrowed by a filter: inside a filtered view,
 *  `servers.length < serverCount` means "also in another server", which is worth
 *  saying — otherwise the filter looks like it lost data. */
export function ServerBadges({
  servers,
  serverCount,
  className,
}: {
  servers: ServerRef[] | undefined;
  serverCount?: number;
  className?: string;
}) {
  const list = servers ?? [];
  if (list.length === 0) return null;

  const hidden = Math.max(0, (serverCount ?? list.length) - list.length);

  return (
    // Wrapping, never a clipped single row: a label that is cut off is worse
    // than one that takes a second line.
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {list.map((server) => (
        <Badge key={server.guildId} variant="outline" className="font-normal">
          {server.label}
        </Badge>
      ))}
      {hidden > 0 ? (
        <Badge
          variant="secondary"
          className="font-normal"
          title={`Also a member of ${hidden} other server${hidden === 1 ? "" : "s"}, outside the current filter.`}
        >
          +{hidden} other
        </Badge>
      ) : null}
    </div>
  );
}

/** Single-server deployments should look like the normal case, so a filter or
 *  a per-server breakdown is hidden entirely rather than rendered with one row. */
export const isMultiServer = (servers: { length: number } | undefined): boolean =>
  (servers?.length ?? 0) > 1;
