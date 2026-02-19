import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "success" | "warning" | "error" | "info" | "default" | "outline" | "secondary"
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = "default", ...props }, ref) => {
        const variants = {
            success: "bg-green-100 text-green-800 border-green-200",
            warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
            error: "bg-red-100 text-red-800 border-red-200",
            info: "bg-blue-100 text-blue-800 border-blue-200",
            default: "bg-gray-100 text-gray-800 border-gray-200",
            outline: "bg-transparent border border-gray-200 text-gray-800",
            secondary: "bg-gray-100 text-gray-800 border-transparent hover:bg-gray-200",
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
