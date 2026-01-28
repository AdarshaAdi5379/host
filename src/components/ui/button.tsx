import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"
    size?: "sm" | "md" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus-ring disabled:opacity-50 disabled:cursor-not-allowed"

        const variants = {
            primary: "bg-brand-purple text-white hover:bg-opacity-90 active:scale-95",
            secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 active:scale-95",
            outline: "border-2 border-brand-purple text-brand-purple hover:bg-brand-purple hover:text-white active:scale-95",
            ghost: "text-gray-700 hover:bg-gray-100 active:scale-95",
            danger: "bg-red-600 text-white hover:bg-red-700 active:scale-95",
        }

        const sizes = {
            sm: "px-3 py-1.5 text-sm",
            md: "px-4 py-2 text-base",
            lg: "px-6 py-3 text-lg",
        }

        return (
            <button
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
