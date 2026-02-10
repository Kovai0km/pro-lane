import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-2 border-foreground bg-primary text-primary-foreground",
        secondary: "border-2 border-foreground bg-secondary text-secondary-foreground",
        destructive: "border-2 border-foreground bg-destructive text-destructive-foreground",
        outline: "border-2 border-foreground bg-background text-foreground",
        pending: "border-2 border-foreground bg-background text-foreground",
        "in-progress": "border-2 border-foreground bg-foreground text-background",
        review: "border-2 border-dashed border-foreground bg-muted text-foreground",
        completed: "border-2 border-foreground bg-foreground text-background",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
