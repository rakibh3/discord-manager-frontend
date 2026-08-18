"use client";

import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  dhakaDaysAgo,
  dhakaToday,
  dhakaYesterday,
  formatCivilDate,
} from "@/lib/dhaka-date";
import {
  countedDays,
  MAX_RANGE_DAYS,
  periodProblem,
  WEEKDAY_SHORT,
  type Period,
} from "@/lib/period";
import { cn } from "@/lib/utils";

/** How wide a range the "switch to range" button opens with: a week reads as an
 *  obviously bounded span, where a month would look like a default to accept. */
const DEFAULT_RANGE_DAYS = 7;

const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatWeekdayAndCivilDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  try {
    const d = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return formatCivilDate(dateStr);
  }
}

interface SinglePreset {
  label: string;
  date: string;
}

interface RangePreset {
  label: string;
  from: string;
  to: string;
}

/** The unified, compact control for choosing a reporting period — one Dhaka day,
 *  or an inclusive span of them — used both URL-backed (the analytics filters) and
 *  locally (the reminder composer). */
export function PeriodPicker({
  value,
  onChange,
  className,
}: {
  value: Period;
  onChange: (next: Period) => void;
  className?: string;
  showWeekdayCaveat?: boolean;
}) {
  const dateId = useId();
  const fromId = useId();
  const toId = useId();

  const today = dhakaToday();
  const yesterday = dhakaYesterday();
  const problem = periodProblem(value);
  const counted = countedDays(value);

  const [year, month] = today.split("-");
  const thisMonthStart = `${year}-${month}-01`;

  const singlePresets: SinglePreset[] = [
    { label: "Today", date: today },
    { label: "Yesterday", date: yesterday },
    { label: "2d ago", date: dhakaDaysAgo(2, today) },
    { label: "7d ago", date: dhakaDaysAgo(7, today) },
  ];

  const rangePresets: RangePreset[] = [
    { label: "Last 7d", from: dhakaDaysAgo(6, today), to: today },
    { label: "Last 14d", from: dhakaDaysAgo(13, today), to: today },
    { label: "Last 30d", from: dhakaDaysAgo(29, today), to: today },
    { label: "This month", from: thisMonthStart, to: today },
  ];

  const toDateMode = () =>
    onChange({
      mode: "date",
      date: value.mode === "range" ? value.to : value.date,
    });

  const toRangeMode = () => {
    const end = value.mode === "date" ? value.date : value.to;
    onChange({
      mode: "range",
      from: dhakaDaysAgo(DEFAULT_RANGE_DAYS - 1, end),
      to: end,
      daysOfWeek: [],
    });
  };

  const toggleWeekday = (day: number) => {
    if (value.mode !== "range") return;
    let nextDays: number[];
    if (value.daysOfWeek.length === 0) {
      nextDays = [day];
    } else if (value.daysOfWeek.includes(day)) {
      nextDays = value.daysOfWeek.filter((entry) => entry !== day);
    } else {
      nextDays = [...value.daysOfWeek, day].sort((a, b) => a - b);
    }
    onChange({ ...value, daysOfWeek: nextDays });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "bg-card/70 border-border/80 text-card-foreground rounded-xl border p-2 shadow-2xs backdrop-blur-xs flex flex-wrap items-center gap-2 sm:gap-2.5",
          className,
        )}
      >
        {/* Mode Switcher */}
        <div
          role="group"
          aria-label="Reporting period mode"
          className="bg-muted/90 inline-flex items-center rounded-lg p-0.5 border border-border/40 shrink-0"
        >
          <button
            type="button"
            onClick={toDateMode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              value.mode === "date"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={value.mode === "date"}
          >
            <CalendarDays className="size-3.5" />
            <span>Single day</span>
          </button>
          <button
            type="button"
            onClick={toRangeMode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              value.mode === "range"
                ? "bg-background text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={value.mode === "range"}
          >
            <CalendarRange className="size-3.5" />
            <span>Date range</span>
          </button>
        </div>

        {/* Date Inputs */}
        {value.mode === "date" ? (
          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor={dateId}
              className="text-xs font-medium text-muted-foreground select-none"
            >
              Date:
            </label>
            <Input
              id={dateId}
              type="date"
              value={value.date}
              max={today}
              onChange={(event) =>
                onChange({ mode: "date", date: event.target.value })
              }
              className="h-8 w-36 px-2.5 text-xs font-medium tracking-tight bg-background cursor-pointer"
            />
            <span className="text-xs font-medium text-foreground/80 bg-muted/40 border border-border/40 rounded-md px-2 py-1 hidden lg:inline-block">
              {formatWeekdayAndCivilDate(value.date)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <label
              htmlFor={fromId}
              className="text-xs font-medium text-muted-foreground select-none"
            >
              From:
            </label>
            <Input
              id={fromId}
              type="date"
              value={value.from}
              max={today}
              onChange={(event) =>
                onChange({ ...value, from: event.target.value })
              }
              className="h-8 w-34 px-2 text-xs font-medium tracking-tight bg-background cursor-pointer"
            />
            <ArrowRight className="size-3.5 text-muted-foreground/50 shrink-0" />
            <label
              htmlFor={toId}
              className="text-xs font-medium text-muted-foreground select-none"
            >
              To:
            </label>
            <Input
              id={toId}
              type="date"
              value={value.to}
              max={today}
              onChange={(event) =>
                onChange({ ...value, to: event.target.value })
              }
              className="h-8 w-34 px-2 text-xs font-medium tracking-tight bg-background cursor-pointer"
            />
          </div>
        )}

        {/* Quick Presets */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] font-medium text-muted-foreground/70 select-none ml-0.5 hidden sm:inline-block">
            Quick:
          </span>
          {value.mode === "date"
            ? singlePresets.map((preset) => {
                const isActive = value.date === preset.date;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChange({ mode: "date", date: preset.date })
                    }
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium transition-colors border",
                      isActive
                        ? "bg-primary/10 text-primary border-primary/30 font-semibold dark:bg-primary/20"
                        : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })
            : rangePresets.map((preset) => {
                const isActive =
                  value.from === preset.from &&
                  value.to === preset.to &&
                  value.daysOfWeek.length === 0;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChange({
                        mode: "range",
                        from: preset.from,
                        to: preset.to,
                        daysOfWeek: [],
                      })
                    }
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium transition-colors border",
                      isActive
                        ? "bg-primary/10 text-primary border-primary/30 font-semibold dark:bg-primary/20"
                        : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
        </div>

        {/* Weekday Narrowing Strip (Range mode) */}
        {value.mode === "range" && (
          <div className="flex items-center gap-1 bg-muted/60 dark:bg-muted/30 p-0.5 px-1.5 rounded-lg border border-border/50 shrink-0">
            <span className="text-[11px] font-medium text-muted-foreground select-none">
              Days:
            </span>
            <div className="flex items-center gap-0.5">
              {WEEKDAY_SHORT.map((label, day) => {
                const everyDay = value.daysOfWeek.length === 0;
                const isSelected = value.daysOfWeek.includes(day);
                const isIncluded = everyDay || isSelected;

                return (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={WEEKDAY_FULL[day]}
                        aria-pressed={isSelected}
                        onClick={() => toggleWeekday(day)}
                        className={cn(
                          "h-6 min-w-6.5 px-1 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : everyDay
                              ? "bg-background text-foreground hover:bg-background/80 shadow-2xs border border-border/40"
                              : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/80 opacity-40 line-through",
                        )}
                      >
                        {label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {WEEKDAY_FULL[day]}: {isIncluded ? "Included in period" : "Excluded"}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {value.daysOfWeek.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, daysOfWeek: [] })}
                    className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline px-1 ml-0.5"
                  >
                    <RotateCcw className="size-3" />
                    <span>All</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Reset to all 7 weekdays</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        {/* Counted Days Badge / Status Indicator (Inline on right or end of wrap) */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {problem ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-0.5 rounded-md border border-destructive/20"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{problem}</span>
            </span>
          ) : value.mode === "range" ? (
            <Badge
              variant="secondary"
              className="gap-1.5 py-0.5 px-2 text-xs font-normal bg-secondary/80 border border-border/60"
            >
              <Sparkles className="size-3 text-primary" />
              <span className="font-semibold text-foreground font-mono">{counted}</span>
              <span className="text-muted-foreground">
                day{counted === 1 ? "" : "s"}
              </span>
              <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
                (max {MAX_RANGE_DAYS})
              </span>
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-[11px]">Asia/Dhaka</span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
