import { useState } from 'react'
import { Eye, EyeOff, Lock, Unlock, AlertCircle, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { isValidEPPCode } from '@/lib/domainUtils'

interface EPPCodeInputProps {
    value: string
    onChange: (value: string) => void
    onValidate?: (code: string) => void
    isValidating?: boolean
    error?: string
}

export function EPPCodeInput({ value, onChange, onValidate, isValidating, error }: EPPCodeInputProps) {
    const [showCode, setShowCode] = useState(false)
    const isValid = value.length > 0 && isValidEPPCode(value)

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                EPP/Authorization Code
            </label>

            <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    {isValid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : value.length > 0 ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : (
                        <Lock className="w-5 h-5 text-gray-400" />
                    )}
                </div>

                <Input
                    type={showCode ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Enter your EPP/Auth code"
                    className={`pl-12 pr-12 ${error ? 'border-red-500' : isValid ? 'border-green-500' : ''
                        }`}
                />

                <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                    {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>

            {error && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </p>
            )}

            {!error && value.length > 0 && !isValid && (
                <p className="text-sm text-gray-600">
                    EPP code must be 8-32 alphanumeric characters
                </p>
            )}

            {isValid && !error && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-green-600 flex items-center space-x-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>Valid EPP code format</span>
                    </p>

                    {onValidate && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onValidate(value)}
                            disabled={isValidating}
                        >
                            {isValidating ? 'Validating...' : 'Validate Code'}
                        </Button>
                    )}
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                <p className="text-xs font-medium text-blue-900 mb-1">
                    Where to find your EPP code:
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                    <li>• GoDaddy: Domain Settings → Transfer Domain</li>
                    <li>• Namecheap: Domain List → Manage → EPP Code</li>
                    <li>• Google Domains: My Domains → Transfer Out</li>
                </ul>
            </div>
        </div>
    )
}
