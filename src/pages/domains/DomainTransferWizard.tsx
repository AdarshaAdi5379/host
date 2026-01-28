import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Check, Loader2, AlertCircle, Lock, Unlock, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EPPCodeInput } from '@/components/domains/EPPCodeInput'
import { useToast } from '@/components/ui/toast'
import { checkDomainLockStatus, validateTransferEligibility, formatPrice } from '@/lib/domainUtils'
import type { TransferStep } from '@/types/domain'

const TRANSFER_STEPS: TransferStep[] = [
    {
        id: 1,
        title: 'Enter Domain',
        description: 'Provide the domain you want to transfer',
        status: 'current',
    },
    {
        id: 2,
        title: 'Unlock Domain',
        description: 'Ensure domain is unlocked at current registrar',
        status: 'pending',
    },
    {
        id: 3,
        title: 'Enter EPP Code',
        description: 'Provide authorization code from current registrar',
        status: 'pending',
    },
    {
        id: 4,
        title: 'Confirm Payment',
        description: 'Complete transfer with 1-year extension',
        status: 'pending',
    },
]

export function DomainTransferWizard() {
    const navigate = useNavigate()
    const { addToast } = useToast()
    const [currentStep, setCurrentStep] = useState(1)
    const [domain, setDomain] = useState('')
    const [eppCode, setEPPCode] = useState('')
    const [nameserverOption, setNameserverOption] = useState<'keep' | 'switch'>('switch')
    const [isChecking, setIsChecking] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [lockStatus, setLockStatus] = useState<{ locked: boolean; registrar: string } | null>(null)
    const [validationError, setValidationError] = useState<string>('')

    const handleCheckDomain = async () => {
        if (!domain) return

        setIsChecking(true)
        try {
            const status = await checkDomainLockStatus(domain)
            setLockStatus(status)

            if (status.locked) {
                addToast({
                    title: 'Domain is Locked',
                    description: `Please unlock your domain at ${status.registrar} before proceeding`,
                    variant: 'warning',
                })
            } else {
                setCurrentStep(3)
                addToast({
                    title: 'Domain is Unlocked',
                    description: 'You can proceed with the transfer',
                    variant: 'success',
                })
            }
        } catch (error) {
            addToast({
                title: 'Error',
                description: 'Failed to check domain status',
                variant: 'error',
            })
        } finally {
            setIsChecking(false)
        }
    }

    const handleValidateEPP = async () => {
        setIsValidating(true)
        setValidationError('')

        try {
            const result = await validateTransferEligibility(domain, eppCode)

            if (result.eligible) {
                setCurrentStep(4)
                addToast({
                    title: 'EPP Code Validated',
                    description: 'Your domain is eligible for transfer',
                    variant: 'success',
                })
            } else {
                setValidationError(result.reason || 'Transfer validation failed')
                addToast({
                    title: 'Validation Failed',
                    description: result.reason,
                    variant: 'error',
                })
            }
        } catch (error) {
            setValidationError('Failed to validate EPP code')
        } finally {
            setIsValidating(false)
        }
    }

    const handleCompleteTransfer = () => {
        addToast({
            title: 'Transfer Initiated',
            description: 'Your domain transfer has been started. This may take 5-7 days.',
            variant: 'success',
        })
        navigate('/domains')
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-brand-navy mb-2">Transfer Your Domain</h1>
                <p className="text-gray-600">
                    Move your domain from another registrar to our platform
                </p>
            </div>

            {/* Progress Steps */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    {TRANSFER_STEPS.map((step, index) => (
                        <div key={step.id} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step.id < currentStep
                                            ? 'bg-green-600 text-white'
                                            : step.id === currentStep
                                                ? 'bg-brand-purple text-white'
                                                : 'bg-gray-200 text-gray-600'
                                        }`}
                                >
                                    {step.id < currentStep ? <Check className="w-5 h-5" /> : step.id}
                                </div>
                                <p className="text-xs font-medium text-gray-700 mt-2 text-center">
                                    {step.title}
                                </p>
                            </div>
                            {index < TRANSFER_STEPS.length - 1 && (
                                <div
                                    className={`h-1 flex-1 mx-2 ${step.id < currentStep ? 'bg-green-600' : 'bg-gray-200'
                                        }`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <Card>
                <CardHeader>
                    <CardTitle>{TRANSFER_STEPS[currentStep - 1].title}</CardTitle>
                    <p className="text-sm text-gray-600">
                        {TRANSFER_STEPS[currentStep - 1].description}
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Step 1: Enter Domain */}
                    {currentStep === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Domain Name
                                </label>
                                <Input
                                    type="text"
                                    placeholder="example.com"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value.toLowerCase())}
                                    className="text-lg"
                                />
                                <p className="text-sm text-gray-600 mt-2">
                                    Enter the full domain name you want to transfer
                                </p>
                            </div>

                            <div className="flex items-center justify-end space-x-3">
                                <Button variant="outline" onClick={() => navigate('/domains')}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => setCurrentStep(2)}
                                    disabled={!domain}
                                >
                                    Continue
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Unlock Domain */}
                    {currentStep === 2 && (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-yellow-900 mb-1">
                                            Action Required at Current Registrar
                                        </h4>
                                        <p className="text-sm text-yellow-800 mb-3">
                                            Before transferring, you must unlock your domain at your current registrar.
                                        </p>
                                        <div className="space-y-2 text-sm text-yellow-800">
                                            <p className="font-medium">How to unlock:</p>
                                            <ul className="list-disc list-inside space-y-1 ml-2">
                                                <li>Log in to your current registrar's dashboard</li>
                                                <li>Find your domain in the domain list</li>
                                                <li>Look for "Domain Lock" or "Transfer Lock" settings</li>
                                                <li>Disable the lock/protection</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-gray-700 mb-3">
                                    Current domain: <span className="font-bold text-brand-navy">{domain}</span>
                                </p>
                                <Button
                                    variant="primary"
                                    onClick={handleCheckDomain}
                                    disabled={isChecking}
                                    className="w-full"
                                >
                                    {isChecking ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Checking Status...
                                        </>
                                    ) : (
                                        <>
                                            <Unlock className="w-4 h-4 mr-2" />
                                            Check if Domain is Unlocked
                                        </>
                                    )}
                                </Button>
                            </div>

                            {lockStatus && (
                                <div
                                    className={`border rounded-lg p-4 ${lockStatus.locked
                                            ? 'bg-red-50 border-red-200'
                                            : 'bg-green-50 border-green-200'
                                        }`}
                                >
                                    <div className="flex items-center space-x-2">
                                        {lockStatus.locked ? (
                                            <Lock className="w-5 h-5 text-red-600" />
                                        ) : (
                                            <Unlock className="w-5 h-5 text-green-600" />
                                        )}
                                        <div>
                                            <p
                                                className={`font-semibold ${lockStatus.locked ? 'text-red-900' : 'text-green-900'
                                                    }`}
                                            >
                                                {lockStatus.locked ? 'Domain is Locked' : 'Domain is Unlocked'}
                                            </p>
                                            <p
                                                className={`text-sm ${lockStatus.locked ? 'text-red-700' : 'text-green-700'
                                                    }`}
                                            >
                                                Current registrar: {lockStatus.registrar}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => setCurrentStep(3)}
                                    disabled={!lockStatus || lockStatus.locked}
                                >
                                    Continue
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Enter EPP Code */}
                    {currentStep === 3 && (
                        <div className="space-y-4">
                            <EPPCodeInput
                                value={eppCode}
                                onChange={setEPPCode}
                                onValidate={handleValidateEPP}
                                isValidating={isValidating}
                                error={validationError}
                            />

                            <div className="flex items-center justify-between">
                                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Confirm Payment */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Check className="w-5 h-5 text-green-600" />
                                    <p className="font-semibold text-green-900">Transfer Validated</p>
                                </div>
                                <p className="text-sm text-green-700">
                                    Your domain is eligible for transfer. Complete payment to initiate the process.
                                </p>
                            </div>

                            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                                <h3 className="font-semibold text-brand-navy">Transfer Summary</h3>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Domain</span>
                                        <span className="font-semibold">{domain}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Current Registrar</span>
                                        <span>{lockStatus?.registrar}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-600">Transfer includes</span>
                                        <Badge variant="success">+1 Year Extension</Badge>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 pt-4">
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Nameserver Configuration
                                        </label>
                                        <div className="space-y-2">
                                            <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-brand-purple transition-colors">
                                                <input
                                                    type="radio"
                                                    name="nameserver"
                                                    value="switch"
                                                    checked={nameserverOption === 'switch'}
                                                    onChange={() => setNameserverOption('switch')}
                                                    className="text-brand-purple focus:ring-brand-purple"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2">
                                                        <Server className="w-4 h-4 text-brand-purple" />
                                                        <span className="font-medium">Use our nameservers</span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Recommended for best performance
                                                    </p>
                                                </div>
                                            </label>
                                            <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-brand-purple transition-colors">
                                                <input
                                                    type="radio"
                                                    name="nameserver"
                                                    value="keep"
                                                    checked={nameserverOption === 'keep'}
                                                    onChange={() => setNameserverOption('keep')}
                                                    className="text-brand-purple focus:ring-brand-purple"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2">
                                                        <Server className="w-4 h-4 text-gray-600" />
                                                        <span className="font-medium">Keep existing nameservers</span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Maintain current DNS configuration
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-lg font-bold pt-4 border-t border-gray-200">
                                        <span>Total</span>
                                        <span className="text-brand-purple">{formatPrice(12.99)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-900 font-medium mb-1">
                                    Transfer Timeline
                                </p>
                                <p className="text-sm text-blue-700">
                                    Domain transfers typically take 5-7 days to complete. You'll receive email updates throughout the process.
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                                <Button variant="primary" onClick={handleCompleteTransfer}>
                                    Complete Transfer
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
