"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { Info } from "lucide-react";

import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DiscordServer } from "@/lib/api/types";

/** Narrows every daily-status read to one server.
 *
 *  Rendered only when more than one server is configured: a single-server
 *  deployment is the *normal* case, and a filter with one option in it is noise
 *  that implies a choice the admin does not have. */
export function ServerFilter({
  servers,
  guildId,
}: {
  servers: DiscordServer[];
  guildId: string | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectId = useId();

  if (servers.length <= 1) return null;

  const push = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "ALL") next.delete("guildId");
    else next.set("guildId", value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <Field className="w-full sm:w-52">
      <div className="flex items-center gap-1">
        <FieldLabel htmlFor={selectId} className="text-xs font-medium">
          Server
        </FieldLabel>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-muted-foreground/60 hover:text-foreground cursor-help inline-flex items-center">
              <Info className="size-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            Rows are one per person. Someone in two servers appears once.
          </TooltipContent>
        </Tooltip>
      </div>
      <Select value={guildId ?? "ALL"} onValueChange={push}>
        <SelectTrigger id={selectId} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="ALL">All servers</SelectItem>
            {servers.map((server) => (
              <SelectItem key={server.guildId} value={server.guildId}>
                {server.label}
                {server.reachable ? "" : " (unreachable)"}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
