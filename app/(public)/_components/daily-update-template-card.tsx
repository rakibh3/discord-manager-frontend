"use client";

import { Check, Copy, MessageSquareText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Builds the exact `#daily-update` template from the program announcement,
 *  pre-filled with today's Dhaka civil date (`YYYY-MM-DD`). */
export function buildDailyUpdateTemplate(date: string): string {
  return [
    `Date: ${date}`,
    "Learning Hour: ",
    "What I Learned Today: ",
    "My Target for Tomorrow: ",
  ].join("\n");
}

/** Copyable `#daily-update` format block. Used both in the attendance companion
 *  rail and inline inside the post-submission success card so students can jump
 *  straight to Discord and paste their structured update. */
export function DailyUpdateTemplateCard({
  today,
  compact = false,
  className,
}: {
  today: string;
  compact?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = buildDailyUpdateTemplate(today);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — leave pre selectable.
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          "border-foreground bg-muted/50 flex flex-col gap-2.5 rounded-xl border-2 p-3.5",
          className,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <MessageSquareText aria-hidden="true" className="size-3.5" />
            <span>
              Next step: post in{" "}
              <code className="font-mono font-bold">#daily-update</code>
            </span>
          </span>
          <Button
            type="button"
            variant={copied ? "sage" : "outline"}
            size="xs"
            onClick={copyTemplate}
          >
            {copied ? (
              <Check data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Copy data-icon="inline-start" aria-hidden="true" />
            )}
            {copied ? "Copied!" : "Copy format"}
          </Button>
        </div>

        <pre className="border-border-muted bg-card overflow-x-auto rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed select-all">
          {template}
        </pre>

        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "Daily update template copied to clipboard." : ""}
        </span>
      </div>
    );
  }

  return (
    <Card accent="sage" size="sm" className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle>
            <h2 className="flex items-center gap-2 text-base">
              <MessageSquareText aria-hidden="true" className="size-4 shrink-0" />
              <span>#daily-update format</span>
            </h2>
          </CardTitle>
          <CardDescription className="text-xs">
            Copy this template for your Discord learning post.
          </CardDescription>
        </div>

        <Button
          type="button"
          variant={copied ? "sage" : "outline"}
          size="xs"
          onClick={copyTemplate}
          className="shrink-0"
        >
          {copied ? (
            <Check data-icon="inline-start" aria-hidden="true" />
          ) : (
            <Copy data-icon="inline-start" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <pre className="border-border-muted bg-muted/60 overflow-x-auto rounded-xl border-2 px-3 py-2.5 font-mono text-xs leading-relaxed select-all">
          {template}
        </pre>
        <p className="text-muted-foreground text-xs leading-relaxed">
          The bot reacts with a checkmark once your post is recorded in{" "}
          <code className="text-foreground font-mono font-semibold">
            #daily-update
          </code>
          .
        </p>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "Daily update template copied to clipboard." : ""}
        </span>
      </CardContent>
    </Card>
  );
}
