import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "success" | "warning" | "error" | "info" | "default"
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = "default", ...props }, ref) => {
        const variants = {
            success: "bg-success-light text-success",
            warning: "bg-yellow-100 text-yellow-800",
            error: "bg-red-100 text-red-800",
            info: "bg-blue-100 text-blue-800",
            default: "bg-gray-100 text-gray-800",
        }

        return (
            <div
                ref={ref}
                className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                    variants[variant],
                    className
                )}
                {...props}
            />
        )
    }
)
Badge.displayName = "Badge"

export { Badge }
