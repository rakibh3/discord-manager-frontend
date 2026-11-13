import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border-2 border-input bg-card px-3 py-1.5 text-base outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-sans file:text-xs file:font-semibold file:text-foreground placeholder:text-muted-foreground focus-visible:shadow-xs focus-visible:ring-3 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/30 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
