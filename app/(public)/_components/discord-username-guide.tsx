import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Reusable native `<details>` guide showing the difference between a Discord
 *  Display Name and the unique `@username` handle. Uses CSS `::details-content`
 *  for smooth open/close transitions and places the chevron before the label for
 *  clean vertical scanning. */
export function DiscordUsernameGuide({
  className,
  defaultOpen = false,
}: {
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "public-disclosure border-border-muted bg-muted/45 rounded-xl border-2 text-sm",
        className,
      )}
    >
      <summary className="text-foreground hover:bg-muted/80 flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 font-medium select-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <ChevronDown
          data-disclosure-chevron
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
        <span>Where do I find my Discord username?</span>
      </summary>

      <div className="border-border-muted flex flex-col gap-3 border-t px-3.5 py-3">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Open Discord and click your profile picture (bottom-left on desktop,{" "}
          <strong className="text-foreground">You</strong> tab on mobile). Enter
          the lowercase handle underneath your display name — leading or
          trailing <code className="text-foreground font-mono">_</code> and{" "}
          <code className="text-foreground font-mono">.</code> are valid.
        </p>

        {/* Mini Discord profile mock contrasting Display Name vs @username */}
        <div
          aria-label="Example Discord profile showing Display Name versus Username"
          className="border-foreground bg-card flex flex-col gap-2 rounded-xl border-2 p-3 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="bg-border-lilac text-[#2D2B32] border-foreground flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold"
              >
                RH
              </span>
              <span className="font-heading text-sm font-bold">
                Rakib Hasan ✨
              </span>
            </div>
            <span className="border-border-coral bg-destructive/15 text-status-error inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold">
              <X aria-hidden="true" className="size-3" />
              Display name
            </span>
          </div>

          <div className="border-border-muted flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <code className="font-mono text-xs font-bold">@rakib_dev</code>
            <span className="border-border-sage bg-success/20 text-status-success inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold">
              <Check aria-hidden="true" className="size-3" />
              Username (use this)
            </span>
          </div>
        </div>
      </div>
    </details>
  );
}
