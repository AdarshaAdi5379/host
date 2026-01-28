import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import { X, Check } from 'lucide-react'

interface FloatingSaveBarProps {
    onSave: () => void
    onDiscard: () => void
}

export function FloatingSaveBar({ onSave, onDiscard }: FloatingSaveBarProps) {
    const { hasUnsavedChanges } = useSettingsStore()

    if (!hasUnsavedChanges) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
            <div className="max-w-7xl mx-auto px-4 pb-4">
                <div className="bg-white border-2 border-brand-purple rounded-xl shadow-xl backdrop-blur-sm p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            <p className="font-medium text-gray-900">
                                You have unsaved changes
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <Button
                                variant="outline"
                                onClick={onDiscard}
                                className="flex items-center space-x-2"
                            >
                                <X className="w-4 h-4" />
                                <span>Discard</span>
                            </Button>
                            <Button
                                variant="primary"
                                onClick={onSave}
                                className="flex items-center space-x-2"
                            >
                                <Check className="w-4 h-4" />
                                <span>Save Changes</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
