import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Friendly neubrutalist: rounded corners, 2px outline, hard offset shadow.
  // A press pushes the button into its shadow, matching the playful reference.
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-foreground bg-clip-padding font-sans text-xs font-semibold normal-case whitespace-nowrap outline-none select-none focus-visible:ring-3 focus-visible:ring-ring active:not-aria-[haspopup]:translate-x-[2px] active:not-aria-[haspopup]:translate-y-[2px] active:not-aria-[haspopup]:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        outline:
          "bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        ghost:
          "border-transparent hover:border-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:border-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/50",
        link: "border-transparent normal-case tracking-normal text-primary underline decoration-2 underline-offset-4 hover:text-accent-foreground",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 rounded-xl text-sm has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-lg px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 rounded-2xl px-4 text-base has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9 rounded-xl",
        "icon-xs":
          "size-6 rounded-lg in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-lg in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
