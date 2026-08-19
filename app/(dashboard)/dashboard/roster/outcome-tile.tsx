import { cn } from "@/lib/utils";

/** One import outcome. The tones are the dashboard's semantic tokens — the same
 *  three the alerts and badges use — so the tiles stay readable in both themes
 *  instead of relying on hand-picked emerald/blue/amber pairs. */
export function OutcomeTile({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number;
  tone?: "success" | "info" | "warning";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-center",
        tone === "success" && "border-success/25 bg-success/8 text-success",
        tone === "info" && "border-info/25 bg-info/8 text-info",
        tone === "warning" && "border-warning/25 bg-warning/8 text-warning",
        className,
      )}
    >
      <div className="text-xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
