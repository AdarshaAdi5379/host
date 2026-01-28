import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToastProps {
    id: string
    title?: string
    description?: string
    variant?: 'default' | 'success' | 'error' | 'warning'
    duration?: number
}

interface ToastContextValue {
    toasts: ToastProps[]
    addToast: (toast: Omit<ToastProps, 'id'>) => void
    removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<ToastProps[]>([])

    const addToast = React.useCallback((toast: Omit<ToastProps, 'id'>) => {
        const id = Math.random().toString(36).substring(7)
        const newToast = { ...toast, id }
        setToasts((prev) => [...prev, newToast])

        const duration = toast.duration || 3000
        setTimeout(() => {
            removeToast(id)
        }, duration)
    }, [])

    const removeToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = React.useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}

function ToastContainer({ toasts, removeToast }: { toasts: ToastProps[]; removeToast: (id: string) => void }) {
    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {toasts.map((toast) => (
                <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    )
}

function Toast({ title, description, variant = 'default', onClose }: ToastProps & { onClose: () => void }) {
    const variants = {
        default: 'bg-white border-gray-200',
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        warning: 'bg-yellow-50 border-yellow-200',
    }

    const iconColors = {
        default: 'text-gray-600',
        success: 'text-green-600',
        error: 'text-red-600',
        warning: 'text-yellow-600',
    }

    return (
        <div
            className={cn(
                'flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-scale-in',
                variants[variant]
            )}
        >
            <div className="flex-1">
                {title && (
                    <h4 className={cn('font-semibold text-sm mb-1', iconColors[variant])}>
                        {title}
                    </h4>
                )}
                {description && (
                    <p className="text-sm text-gray-600">{description}</p>
                )}
            </div>
            <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
