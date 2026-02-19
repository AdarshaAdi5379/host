
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

const SelectContext = React.createContext<{
    value: string
    onChange: (value: string) => void
    open: boolean
    setOpen: (open: boolean) => void
} | null>(null)

export function Select({
    value,
    onValueChange,
    children
}: {
    value: string
    onValueChange: (value: string) => void
    children: React.ReactNode
}) {
    const [open, setOpen] = React.useState(false)

    return (
        <SelectContext.Provider value={{ value, onChange: onValueChange, open, setOpen }}>
            <div className="relative">
                {children}
            </div>
        </SelectContext.Provider>
    )
}

export function SelectTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectTrigger must be used within Select")

    return (
        <button
            type="button"
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            onClick={() => context.setOpen(!context.open)}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    )
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
    const context = React.useContext(SelectContext)
    // This is simplified; normally you'd map value to label. 
    // For now we rely on the parent logic or just showing value if children don't map easily.
    return <span>{context?.value || placeholder}</span>
}

export function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
    const context = React.useContext(SelectContext)
    if (!context || !context.open) return null

    return (
        <div className={cn(
            "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white text-gray-950 shadow-md animate-in fade-in-80",
            className
        )}>
            <div className="p-1">
                {children}
            </div>
        </div>
    )
}

export function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectItem must be used within Select")

    return (
        <div
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-gray-100",
                className
            )}
            onClick={() => {
                context.onChange(value)
                context.setOpen(false)
            }}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {context.value === value && (
                    <span className="flex h-2 w-2 rounded-full bg-current" />
                )}
            </span>
            {children}
        </div>
    )
}
