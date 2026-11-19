import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-xl border-2 px-3.5 py-3 shadow-xs text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground shadow-xs",
        destructive:
          "border-[var(--border-coral)] bg-destructive/10 text-destructive shadow-[2px_2px_0_0_var(--border-coral)] *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        // The health banners distinguish three severities: an outage that is
        // actively losing data (destructive), a guard that fired correctly
        // (warning), and a recovered/healthy state (success). Collapsing the
        // middle one into destructive would train admins to ignore all three.
        warning:
          "border-[var(--border-yellow)] bg-warning/15 text-foreground shadow-[2px_2px_0_0_var(--border-yellow)] *:data-[slot=alert-description]:text-foreground/90 *:[svg]:text-current",
        success:
          "border-[var(--border-sage)] bg-success/15 text-foreground shadow-[2px_2px_0_0_var(--border-sage)] *:data-[slot=alert-description]:text-foreground/90 *:[svg]:text-current",
        info:
          "border-[var(--border-lilac)] bg-info/15 text-foreground shadow-[2px_2px_0_0_var(--border-lilac)] *:data-[slot=alert-description]:text-foreground/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
