import { useState, useRef } from 'react'
import { Upload, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateInitialsAvatar } from '@/lib/identicon'
import { useAuthStore } from '@/store/authStore'

interface AvatarUploadProps {
    currentAvatar?: string
    onAvatarChange: (file: File | null) => void
}

export function AvatarUpload({ currentAvatar, onAvatarChange }: AvatarUploadProps) {
    const { user } = useAuthStore()
    const [preview, setPreview] = useState<string | null>(currentAvatar || null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB')
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            setPreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
        onAvatarChange(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const file = e.dataTransfer.files[0]
        if (file) {
            handleFileSelect(file)
        }
    }

    const handleRemove = () => {
        setPreview(null)
        onAvatarChange(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const fallbackAvatar = user ? generateInitialsAvatar(user.name) : null

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-6">
                {/* Avatar Preview */}
                <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                        {preview || currentAvatar ? (
                            <img
                                src={preview || currentAvatar}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                            />
                        ) : fallbackAvatar ? (
                            <img src={fallbackAvatar} alt="Avatar" className="w-full h-full" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <User className="w-12 h-12 text-gray-400" />
                            </div>
                        )}
                    </div>
                    {(preview || currentAvatar) && (
                        <button
                            onClick={handleRemove}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Upload Area */}
                <div className="flex-1">
                    <div
                        onDragOver={(e) => {
                            e.preventDefault()
                            setIsDragging(true)
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging
                                ? 'border-brand-purple bg-purple-50'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                    >
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-2">
                            Drag and drop your photo here, or{' '}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-brand-purple font-medium hover:underline"
                            >
                                browse
                            </button>
                        </p>
                        <p className="text-xs text-gray-500">
                            JPG, PNG or GIF. Max size 5MB.
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileSelect(file)
                            }}
                            className="hidden"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
