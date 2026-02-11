import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DeleteConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    siteName: string
    isLoading: boolean
}

export default function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    siteName,
    isLoading
}: DeleteConfirmationModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-red-50">
                    <div className="flex items-center space-x-2 text-red-600">
                        <AlertTriangle className="w-5 h-5" />
                        <h2 className="text-xl font-semibold">Delete Site?</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={isLoading}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <p className="text-gray-600">
                        Are you sure you want to delete <span className="font-bold text-gray-900">{siteName}</span>?
                    </p>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100">
                        This action cannot be undone. All files, databases, and configuration will be permanently lost.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            'Delete Site'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
