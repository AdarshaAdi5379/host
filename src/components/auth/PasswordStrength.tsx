import { useState } from 'react'
import { checkPasswordRequirements } from '@/lib/authValidation'
import { Progress } from '@/components/ui/progress'
import { Check, X } from 'lucide-react'

interface PasswordStrengthProps {
    password: string
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
    const requirements = checkPasswordRequirements(password)

    const getStrength = () => {
        const met = Object.values(requirements).filter(Boolean).length
        if (met <= 2) return { label: 'Weak', value: 25, color: 'danger' as const }
        if (met <= 3) return { label: 'Medium', value: 50, color: 'warning' as const }
        if (met <= 4) return { label: 'Strong', value: 75, color: 'primary' as const }
        return { label: 'Very Strong', value: 100, color: 'primary' as const }
    }

    const strength = getStrength()

    if (!password) return null

    return (
        <div className="space-y-3">
            {/* Strength Bar */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Password Strength</span>
                    <span className="text-sm font-semibold">{strength.label}</span>
                </div>
                <Progress value={strength.value} variant={strength.color} />
            </div>

            {/* Requirements Checklist */}
            <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">Requirements:</p>
                <div className="space-y-1">
                    <RequirementItem
                        met={requirements.minLength}
                        label="At least 8 characters"
                    />
                    <RequirementItem
                        met={requirements.hasUppercase}
                        label="One uppercase letter"
                    />
                    <RequirementItem
                        met={requirements.hasLowercase}
                        label="One lowercase letter"
                    />
                    <RequirementItem met={requirements.hasNumber} label="One number" />
                    <RequirementItem
                        met={requirements.hasSpecial}
                        label="One special character"
                    />
                </div>
            </div>
        </div>
    )
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
    return (
        <div className="flex items-center space-x-2 text-xs">
            {met ? (
                <Check className="w-4 h-4 text-green-600" />
            ) : (
                <X className="w-4 h-4 text-gray-400" />
            )}
            <span className={met ? 'text-green-600' : 'text-gray-600'}>{label}</span>
        </div>
    )
}
