import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number
    max?: number
    variant?: "primary" | "success" | "warning" | "danger"
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
    ({ className, value = 0, max = 100, variant = "primary", ...props }, ref) => {
        const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

        const variants = {
            primary: "bg-brand-purple",
            success: "bg-success",
            warning: "bg-yellow-500",
            danger: "bg-red-500",
        }

        return (
            <div
                ref={ref}
                className={cn(
                    "relative h-2 w-full overflow-hidden rounded-full bg-gray-200",
                    className
                )}
                {...props}
            >
                <div
                    className={cn(
                        "h-full transition-all duration-300 ease-in-out",
                        variants[variant]
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        )
    }
)
Progress.displayName = "Progress"

export { Progress }
