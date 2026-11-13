import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border-2 border-foreground px-2.5 py-0.5 font-sans text-xs font-semibold normal-case whitespace-nowrap focus-visible:ring-3 focus-visible:ring-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground [a]:hover:bg-accent [a]:hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-accent [a]:hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground focus-visible:ring-destructive/50 [a]:hover:bg-foreground [a]:hover:text-background",
        outline:
          "bg-background text-foreground [a]:hover:bg-accent [a]:hover:text-accent-foreground",
        // Matches the three severities `alert.tsx` already distinguishes: a
        // state that is actively wrong (destructive), one that is partly wrong
        // and needs a decision (warning), and a healthy one (success). A
        // multi-server action that succeeded in some servers and not others is
        // exactly the middle case, and must not be painted as either extreme.
        // Warning is the loud yellow highlight (always black text) rather than
        // `--warning`, which is tuned to be readable as text on a page.
        warning:
          "bg-highlight text-highlight-foreground [a]:hover:bg-foreground [a]:hover:text-background",
        success:
          "bg-success text-success-foreground [a]:hover:bg-foreground [a]:hover:text-background",
        ghost:
          "border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "border-transparent normal-case text-primary underline decoration-2 underline-offset-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
