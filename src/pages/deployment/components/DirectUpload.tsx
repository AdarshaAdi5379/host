import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { UploadCloud, FileArchive, X, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface DirectUploadProps {
    onUploadComplete: () => void
}

export function DirectUpload({ onUploadComplete }: DirectUploadProps) {
    const { addToast } = useToast()
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [uploadSpeed, setUploadSpeed] = useState('0 MB/s')
    const [timeLeft, setTimeLeft] = useState('0s')

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const droppedFile = acceptedFiles[0]
        if (droppedFile) {
            if (droppedFile.size > 500 * 1024 * 1024) { // 500MB limit
                addToast({
                    title: 'File too large',
                    description: 'Maximum upload size is 500MB',
                    variant: 'error',
                })
                return
            }
            setFile(droppedFile)
            setProgress(0)
        }
    }, [addToast])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/zip': ['.zip'],
            'application/x-zip-compressed': ['.zip'],
        },
        maxFiles: 1,
    })

    const handleUpload = () => {
        if (!file) return

        setUploading(true)
        setProgress(0)

        // Simulate chunked upload
        let currentProgress = 0
        const interval = setInterval(() => {
            currentProgress += Math.random() * 5
            if (currentProgress >= 100) {
                currentProgress = 100
                clearInterval(interval)
                setUploading(false)
                addToast({
                    title: 'Upload Complete',
                    description: `${file.name} has been successfully uploaded and extracted.`,
                    variant: 'success',
                })
                onUploadComplete()
            }

            setProgress(Math.min(currentProgress, 100))

            // Random speed simulation (2-8 MB/s)
            setUploadSpeed(`${(Math.random() * 6 + 2).toFixed(1)} MB/s`)

            // Time left simulation
            const remaining = (100 - currentProgress)
            setTimeLeft(`${(remaining / 5).toFixed(0)}s`)

        }, 200)
    }

    const removeFile = () => {
        setFile(null)
        setProgress(0)
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {!file ? (
                <div
                    {...getRootProps()}
                    className={`
                        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                        ${isDragActive
                            ? 'border-brand-purple bg-brand-purple/5'
                            : 'border-gray-200 hover:border-brand-purple hover:bg-gray-50'
                        }
                    `}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className={`p-4 rounded-full ${isDragActive ? 'bg-brand-purple/10' : 'bg-gray-100'}`}>
                            <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-brand-purple' : 'text-gray-400'}`} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                {isDragActive ? 'Drop file here' : 'Drag & drop your zip file'}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                or click to browse (Max 500MB)
                            </p>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <FileArchive className="w-3 h-3" />
                            <span>Supports .zip archives only</span>
                        </div>
                    </div>
                </div>
            ) : (
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-purple-50 rounded-lg">
                                    <FileArchive className="w-6 h-6 text-brand-purple" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900">{file.name}</h4>
                                    <p className="text-sm text-gray-500">
                                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                </div>
                            </div>
                            {!uploading && (
                                <Button variant="ghost" size="sm" onClick={removeFile}>
                                    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                </Button>
                            )}
                        </div>

                        {uploading ? (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Uploading...</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>{uploadSpeed}</span>
                                    <span>{timeLeft} remaining</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between mt-6">
                                <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Existing files will be overwritten</span>
                                </div>
                                <Button onClick={handleUpload} variant="primary">
                                    <UploadCloud className="w-4 h-4 mr-2" />
                                    Start Upload
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
