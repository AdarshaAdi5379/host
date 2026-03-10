import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Activity,
    Cpu,
    Download,
    KeyRound,
    Loader2,
    Play,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Server,
    Shield,
    Square,
    Trash2,
} from 'lucide-react'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import {
    wordpressAPI,
    type ComputeFlavor,
    type ComputeImage,
    type ComputeInstance,
    type ComputeOperation,
    type ComputeOperationPollResponse,
    type ComputeSSHKey,
    type ComputeSecurityGroup,
} from '@/lib/wordpressAPI'
import { formatDateTime } from '@/lib/utils'

type InstanceAction = 'start' | 'stop' | 'reboot' | 'terminate' | 'describe'
type SSHKeyType = 'ed25519' | 'rsa'
type RuleDirection = 'ingress' | 'egress'
type RuleProtocol = 'tcp' | 'udp' | 'icmp' | 'all'

interface InstanceOperationState {
    operationId: number
    operation: ComputeOperation['operation']
    status: ComputeOperation['status']
    terminal: boolean
    error: string
    updatedAt: number
}

interface CreateFormState {
    name: string
    imageId: number
    flavorId: number
    sshKeyId: number
    securityGroupIds: number[]
}

interface GenerateSSHFormState {
    name: string
    keyType: SSHKeyType
    bits: number
    comment: string
}

interface SecurityGroupCreateFormState {
    name: string
    description: string
    isDefault: boolean
}

interface SecurityRuleCreateFormState {
    direction: RuleDirection
    protocol: RuleProtocol
    fromPort: string
    toPort: string
    cidr: string
    description: string
}

const TRANSIENT_INSTANCE_STATES = new Set([
    'provisioning',
    'pending',
    'starting',
    'stopping',
    'rebooting',
    'terminating',
])

const DEFAULT_RULE_FORM: SecurityRuleCreateFormState = {
    direction: 'ingress',
    protocol: 'tcp',
    fromPort: '22',
    toPort: '22',
    cidr: '0.0.0.0/0',
    description: '',
}

function generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `ec2-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatStateLabel(state: string): string {
    if (!state) return 'Unknown'
    return state.charAt(0).toUpperCase() + state.slice(1)
}

function sameNumberArray(a: number[], b: number[]): boolean {
    if (a.length !== b.length) {
        return false
    }
    return a.every((value, index) => value === b[index])
}

function operationToastTitle(status: ComputeOperation['status']): string {
    if (status === 'success') {
        return 'Operation completed'
    }
    if (status === 'failed' || status === 'cancelled' || status === 'superseded') {
        return 'Operation failed'
    }
    return 'Operation update'
}

function triggerDownload(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
}

export function Ec2Service() {
    const { addToast } = useToast()

    const [images, setImages] = useState<ComputeImage[]>([])
    const [flavors, setFlavors] = useState<ComputeFlavor[]>([])
    const [sshKeys, setSshKeys] = useState<ComputeSSHKey[]>([])
    const [securityGroups, setSecurityGroups] = useState<ComputeSecurityGroup[]>([])
    const [instances, setInstances] = useState<ComputeInstance[]>([])

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const [activeAction, setActiveAction] = useState<{ instanceId: number; action: InstanceAction } | null>(null)
    const [operationsByInstance, setOperationsByInstance] = useState<Record<number, InstanceOperationState>>({})
    const [createForm, setCreateForm] = useState<CreateFormState>({
        name: '',
        imageId: 0,
        flavorId: 0,
        sshKeyId: 0,
        securityGroupIds: [],
    })

    const [sshGenerateForm, setSshGenerateForm] = useState<GenerateSSHFormState>({
        name: '',
        keyType: 'ed25519',
        bits: 4096,
        comment: '',
    })
    const [sshGenerateLoading, setSshGenerateLoading] = useState(false)
    const [sshImportName, setSshImportName] = useState('')
    const [sshImportPublicKey, setSshImportPublicKey] = useState('')
    const [sshImportLoading, setSshImportLoading] = useState(false)

    const [securityGroupCreateForm, setSecurityGroupCreateForm] = useState<SecurityGroupCreateFormState>({
        name: '',
        description: '',
        isDefault: false,
    })
    const [securityGroupCreateLoading, setSecurityGroupCreateLoading] = useState(false)
    const [selectedSecurityGroupId, setSelectedSecurityGroupId] = useState<number>(0)
    const [securityRuleCreateForm, setSecurityRuleCreateForm] = useState<SecurityRuleCreateFormState>(DEFAULT_RULE_FORM)
    const [securityRuleCreateLoading, setSecurityRuleCreateLoading] = useState(false)
    const [securityRuleDeleteLoadingId, setSecurityRuleDeleteLoadingId] = useState<number | null>(null)

    const pollingTimeoutsRef = useRef<Record<number, number>>({})
    const notifiedOperationsRef = useRef<Set<number>>(new Set())
    const isUnmountedRef = useRef(false)

    const getStateBadge = (state: string) => {
        if (state === 'running') {
            return <Badge variant="success">Running</Badge>
        }
        if (state === 'stopped') {
            return <Badge variant="default">Stopped</Badge>
        }
        if (state === 'terminated') {
            return <Badge variant="outline">Terminated</Badge>
        }
        if (state === 'error') {
            return <Badge variant="error">Error</Badge>
        }
        if (TRANSIENT_INSTANCE_STATES.has(state)) {
            return <Badge variant="warning">{formatStateLabel(state)}</Badge>
        }
        return <Badge variant="info">{formatStateLabel(state)}</Badge>
    }

    const loadInstances = useCallback(async () => {
        const data = await wordpressAPI.getComputeInstances()
        if (!isUnmountedRef.current) {
            setInstances(data)
        }
    }, [])

    const clearPollingTimer = useCallback((operationId: number) => {
        const timeoutId = pollingTimeoutsRef.current[operationId]
        if (timeoutId) {
            window.clearTimeout(timeoutId)
            delete pollingTimeoutsRef.current[operationId]
        }
    }, [])

    const handlePollResult = useCallback(
        async (instanceId: number, operationId: number, response: ComputeOperationPollResponse) => {
            if (isUnmountedRef.current) {
                return
            }

            setOperationsByInstance((previous) => ({
                ...previous,
                [instanceId]: {
                    operationId,
                    operation: response.operation.operation,
                    status: response.status,
                    terminal: response.terminal,
                    error: response.operation.error || '',
                    updatedAt: Date.now(),
                },
            }))

            if (response.terminal) {
                clearPollingTimer(operationId)
                await loadInstances()

                if (!notifiedOperationsRef.current.has(operationId)) {
                    notifiedOperationsRef.current.add(operationId)
                    addToast({
                        title: operationToastTitle(response.status),
                        description: response.operation.error || `${response.operation.operation} for ${response.operation.instance_name} is ${response.status}.`,
                        variant: response.status === 'success' ? 'success' : 'error',
                    })
                }
                return
            }

            const waitSeconds = Math.max(1, response.poll_after_seconds || 2)
            pollingTimeoutsRef.current[operationId] = window.setTimeout(() => {
                void pollOperation(instanceId, operationId)
            }, waitSeconds * 1000)
        },
        [addToast, clearPollingTimer, loadInstances]
    )

    const pollOperation = useCallback(
        async (instanceId: number, operationId: number) => {
            try {
                const pollResponse = await wordpressAPI.pollComputeOperation(operationId)
                await handlePollResult(instanceId, operationId, pollResponse)
            } catch (error) {
                clearPollingTimer(operationId)
                const errorMessage = error instanceof Error ? error.message : 'Failed to poll operation status'
                setOperationsByInstance((previous) => ({
                    ...previous,
                    [instanceId]: {
                        operationId,
                        operation: previous[instanceId]?.operation || 'describe',
                        status: 'failed',
                        terminal: true,
                        error: errorMessage,
                        updatedAt: Date.now(),
                    },
                }))
                if (!notifiedOperationsRef.current.has(operationId)) {
                    notifiedOperationsRef.current.add(operationId)
                    addToast({
                        title: 'Polling failed',
                        description: errorMessage,
                        variant: 'error',
                    })
                }
            }
        },
        [addToast, clearPollingTimer, handlePollResult]
    )

    const trackOperation = useCallback(
        (instanceId: number, operation: ComputeOperation) => {
            const terminal = operation.status === 'success' || operation.status === 'failed' || operation.status === 'superseded' || operation.status === 'cancelled'
            setOperationsByInstance((previous) => ({
                ...previous,
                [instanceId]: {
                    operationId: operation.id,
                    operation: operation.operation,
                    status: operation.status,
                    terminal,
                    error: operation.error || '',
                    updatedAt: Date.now(),
                },
            }))

            clearPollingTimer(operation.id)
            if (!terminal) {
                void pollOperation(instanceId, operation.id)
            }
        },
        [clearPollingTimer, pollOperation]
    )

    const loadData = useCallback(
        async (fullLoad: boolean) => {
            if (fullLoad) {
                setLoading(true)
            } else {
                setRefreshing(true)
            }

            try {
                const [imagesResult, flavorsResult, sshKeysResult, groupsResult, instancesResult] = await Promise.allSettled([
                    wordpressAPI.getComputeImages(),
                    wordpressAPI.getComputeFlavors(),
                    wordpressAPI.getComputeSSHKeys(),
                    wordpressAPI.getComputeSecurityGroups(),
                    wordpressAPI.getComputeInstances(),
                ])

                if (isUnmountedRef.current) {
                    return
                }

                if (imagesResult.status === 'fulfilled') {
                    setImages(imagesResult.value)
                } else {
                    setImages([])
                    addToast({
                        title: 'Failed to load images',
                        description: imagesResult.reason instanceof Error ? imagesResult.reason.message : 'Unknown error',
                        variant: 'error',
                    })
                }

                if (flavorsResult.status === 'fulfilled') {
                    setFlavors(flavorsResult.value)
                } else {
                    setFlavors([])
                    addToast({
                        title: 'Failed to load instance types',
                        description: flavorsResult.reason instanceof Error ? flavorsResult.reason.message : 'Unknown error',
                        variant: 'error',
                    })
                }

                if (sshKeysResult.status === 'fulfilled') {
                    setSshKeys(sshKeysResult.value)
                } else {
                    setSshKeys([])
                    addToast({
                        title: 'Failed to load SSH keys',
                        description: sshKeysResult.reason instanceof Error ? sshKeysResult.reason.message : 'Unknown error',
                        variant: 'error',
                    })
                }

                if (groupsResult.status === 'fulfilled') {
                    setSecurityGroups(groupsResult.value)
                } else {
                    setSecurityGroups([])
                    addToast({
                        title: 'Failed to load security groups',
                        description: groupsResult.reason instanceof Error ? groupsResult.reason.message : 'Unknown error',
                        variant: 'error',
                    })
                }

                if (instancesResult.status === 'fulfilled') {
                    setInstances(instancesResult.value)
                } else {
                    setInstances([])
                    addToast({
                        title: 'Failed to load instances',
                        description: instancesResult.reason instanceof Error ? instancesResult.reason.message : 'Unknown error',
                        variant: 'error',
                    })
                }
            } catch (error) {
                addToast({
                    title: 'Failed to load EC2 resources',
                    description: error instanceof Error ? error.message : 'Unknown error',
                    variant: 'error',
                })
            } finally {
                if (fullLoad) {
                    setLoading(false)
                } else {
                    setRefreshing(false)
                }
            }
        },
        [addToast]
    )

    useEffect(() => {
        void loadData(true)
    }, [loadData])

    useEffect(() => {
        setCreateForm((previous) => {
            const nextImageId = images.some((item) => item.id === previous.imageId)
                ? previous.imageId
                : (images.find((item) => item.is_default)?.id || images[0]?.id || 0)
            const nextFlavorId = flavors.some((item) => item.id === previous.flavorId)
                ? previous.flavorId
                : (flavors[0]?.id || 0)
            const nextSshKeyId = sshKeys.some((item) => item.id === previous.sshKeyId)
                ? previous.sshKeyId
                : (sshKeys[0]?.id || 0)
            const validGroupIds = new Set(securityGroups.map((group) => group.id))
            const nextGroupIds = previous.securityGroupIds.filter((id) => validGroupIds.has(id))

            if (
                previous.imageId === nextImageId &&
                previous.flavorId === nextFlavorId &&
                previous.sshKeyId === nextSshKeyId &&
                sameNumberArray(previous.securityGroupIds, nextGroupIds)
            ) {
                return previous
            }

            return {
                ...previous,
                imageId: nextImageId,
                flavorId: nextFlavorId,
                sshKeyId: nextSshKeyId,
                securityGroupIds: nextGroupIds,
            }
        })
    }, [flavors, images, securityGroups, sshKeys])

    useEffect(() => {
        if (securityGroups.length === 0) {
            setSelectedSecurityGroupId(0)
            return
        }
        if (!securityGroups.some((group) => group.id === selectedSecurityGroupId)) {
            setSelectedSecurityGroupId(securityGroups[0].id)
        }
    }, [securityGroups, selectedSecurityGroupId])

    useEffect(() => {
        return () => {
            isUnmountedRef.current = true
            Object.values(pollingTimeoutsRef.current).forEach((timeoutId) => {
                window.clearTimeout(timeoutId)
            })
        }
    }, [])

    const runningCount = useMemo(
        () => instances.filter((instance) => instance.state === 'running').length,
        [instances]
    )

    const pendingOperationCount = useMemo(
        () => Object.values(operationsByInstance).filter((operation) => !operation.terminal).length,
        [operationsByInstance]
    )

    const hasCreateDependencies = images.length > 0 && flavors.length > 0 && sshKeys.length > 0

    const isInstanceBusy = useCallback(
        (instance: ComputeInstance) => {
            const operation = operationsByInstance[instance.id]
            return TRANSIENT_INSTANCE_STATES.has(instance.state) || Boolean(operation && !operation.terminal)
        },
        [operationsByInstance]
    )

    const selectedSecurityGroup = useMemo(
        () => securityGroups.find((group) => group.id === selectedSecurityGroupId) || null,
        [securityGroups, selectedSecurityGroupId]
    )

    const securityRules = useMemo(() => {
        if (!selectedSecurityGroup?.rules) {
            return []
        }
        return [...selectedSecurityGroup.rules].sort((a, b) => {
            if (a.direction !== b.direction) {
                return a.direction.localeCompare(b.direction)
            }
            if (a.protocol !== b.protocol) {
                return a.protocol.localeCompare(b.protocol)
            }
            return (a.from_port || 0) - (b.from_port || 0)
        })
    }, [selectedSecurityGroup])

    const refreshSecurityGroups = useCallback(async () => {
        const groups = await wordpressAPI.getComputeSecurityGroups()
        setSecurityGroups(groups)
    }, [])

    const refreshSSHKeys = useCallback(async () => {
        const keys = await wordpressAPI.getComputeSSHKeys()
        setSshKeys(keys)
    }, [])

    const handleRefresh = async () => {
        await loadData(false)
    }

    const handleSecurityGroupToggle = (groupId: number, checked: boolean) => {
        setCreateForm((previous) => {
            const current = new Set(previous.securityGroupIds)
            if (checked) {
                current.add(groupId)
            } else {
                current.delete(groupId)
            }
            return {
                ...previous,
                securityGroupIds: Array.from(current).sort((a, b) => a - b),
            }
        })
    }

    const handleCreateInstance = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!createForm.name.trim()) {
            addToast({
                title: 'Name required',
                description: 'Provide an instance name before submitting.',
                variant: 'warning',
            })
            return
        }
        if (!createForm.imageId || !createForm.flavorId || !createForm.sshKeyId) {
            addToast({
                title: 'Missing create inputs',
                description: 'Image, instance type, and SSH key are required.',
                variant: 'warning',
            })
            return
        }

        setCreateLoading(true)
        try {
            const response = await wordpressAPI.createComputeInstance({
                name: createForm.name.trim(),
                image_id: createForm.imageId,
                flavor_id: createForm.flavorId,
                ssh_key_id: createForm.sshKeyId,
                security_group_ids: createForm.securityGroupIds,
            })

            setCreateForm((previous) => ({
                ...previous,
                name: '',
            }))

            setInstances((previous) => {
                const withoutCurrent = previous.filter((instance) => instance.id !== response.instance.id)
                return [response.instance, ...withoutCurrent]
            })

            addToast({
                title: 'Instance creation queued',
                description: `Operation #${response.operation.id} is in progress.`,
                variant: 'info',
            })

            trackOperation(response.instance.id, response.operation)
        } catch (error) {
            addToast({
                title: 'Failed to create instance',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setCreateLoading(false)
        }
    }

    const queueAction = async (instance: ComputeInstance, action: InstanceAction) => {
        setActiveAction({ instanceId: instance.id, action })
        try {
            const response = await wordpressAPI.queueComputeInstanceAction(
                instance.id,
                action,
                generateIdempotencyKey()
            )
            addToast({
                title: `${formatStateLabel(action)} queued`,
                description: `Operation #${response.operation.id} is in progress.`,
                variant: 'info',
            })
            trackOperation(instance.id, response.operation)
        } catch (error) {
            addToast({
                title: `Failed to ${action} instance`,
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setActiveAction(null)
        }
    }

    const handleGenerateSSHKey = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!sshGenerateForm.name.trim()) {
            addToast({
                title: 'Key name required',
                description: 'Enter a key name to generate.',
                variant: 'warning',
            })
            return
        }

        setSshGenerateLoading(true)
        try {
            const response = await wordpressAPI.generateComputeSSHKey({
                name: sshGenerateForm.name.trim(),
                key_type: sshGenerateForm.keyType,
                bits: sshGenerateForm.keyType === 'rsa' ? sshGenerateForm.bits : undefined,
                comment: sshGenerateForm.comment.trim() || undefined,
            })

            triggerDownload(response.download_filename || `${response.key.name}.pem`, response.private_key)
            await refreshSSHKeys()

            setCreateForm((previous) => ({
                ...previous,
                sshKeyId: response.key.id,
            }))
            setSshGenerateForm((previous) => ({
                ...previous,
                name: '',
                comment: '',
            }))

            addToast({
                title: 'SSH key generated',
                description: 'Private key downloaded once. Keep it safe; it cannot be retrieved again.',
                variant: 'success',
            })
        } catch (error) {
            addToast({
                title: 'Failed to generate SSH key',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setSshGenerateLoading(false)
        }
    }

    const handleImportSSHKey = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!sshImportName.trim() || !sshImportPublicKey.trim()) {
            addToast({
                title: 'Import data required',
                description: 'Provide key name and public key.',
                variant: 'warning',
            })
            return
        }

        setSshImportLoading(true)
        try {
            const key = await wordpressAPI.createComputeSSHKey({
                name: sshImportName.trim(),
                public_key: sshImportPublicKey.trim(),
            })
            await refreshSSHKeys()
            setCreateForm((previous) => ({
                ...previous,
                sshKeyId: key.id,
            }))
            setSshImportName('')
            setSshImportPublicKey('')
            addToast({
                title: 'SSH key imported',
                description: `Key ${key.name} is now available for instance launch.`,
                variant: 'success',
            })
        } catch (error) {
            addToast({
                title: 'Failed to import SSH key',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setSshImportLoading(false)
        }
    }

    const handleCreateSecurityGroup = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!securityGroupCreateForm.name.trim()) {
            addToast({
                title: 'Security group name required',
                description: 'Enter a security group name.',
                variant: 'warning',
            })
            return
        }

        setSecurityGroupCreateLoading(true)
        try {
            const group = await wordpressAPI.createComputeSecurityGroup({
                name: securityGroupCreateForm.name.trim(),
                description: securityGroupCreateForm.description.trim(),
                is_default: securityGroupCreateForm.isDefault,
            })
            await refreshSecurityGroups()
            setSelectedSecurityGroupId(group.id)
            setSecurityGroupCreateForm({
                name: '',
                description: '',
                isDefault: false,
            })
            addToast({
                title: 'Security group created',
                description: `${group.name} is ready for rule configuration.`,
                variant: 'success',
            })
        } catch (error) {
            addToast({
                title: 'Failed to create security group',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setSecurityGroupCreateLoading(false)
        }
    }

    const handleCreateSecurityRule = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!selectedSecurityGroup) {
            addToast({
                title: 'No security group selected',
                description: 'Create or select a security group first.',
                variant: 'warning',
            })
            return
        }
        if (!securityRuleCreateForm.cidr.trim()) {
            addToast({
                title: 'CIDR required',
                description: 'Provide CIDR block such as 0.0.0.0/0.',
                variant: 'warning',
            })
            return
        }

        const needsPorts = securityRuleCreateForm.protocol === 'tcp' || securityRuleCreateForm.protocol === 'udp'
        let fromPort: number | null = null
        let toPort: number | null = null

        if (needsPorts) {
            const parsedFrom = Number(securityRuleCreateForm.fromPort)
            const parsedTo = Number(securityRuleCreateForm.toPort)
            if (!Number.isInteger(parsedFrom) || !Number.isInteger(parsedTo) || parsedFrom < 0 || parsedTo < 0 || parsedFrom > 65535 || parsedTo > 65535 || parsedFrom > parsedTo) {
                addToast({
                    title: 'Invalid port range',
                    description: 'Use valid ports (0-65535) and from <= to.',
                    variant: 'warning',
                })
                return
            }
            fromPort = parsedFrom
            toPort = parsedTo
        }

        setSecurityRuleCreateLoading(true)
        try {
            await wordpressAPI.createComputeSecurityGroupRule(selectedSecurityGroup.id, {
                direction: securityRuleCreateForm.direction,
                protocol: securityRuleCreateForm.protocol,
                from_port: fromPort,
                to_port: toPort,
                cidr: securityRuleCreateForm.cidr.trim(),
                description: securityRuleCreateForm.description.trim(),
            })
            await refreshSecurityGroups()
            setSecurityRuleCreateForm(DEFAULT_RULE_FORM)
            addToast({
                title: 'Security rule added',
                description: `Rule added to ${selectedSecurityGroup.name}.`,
                variant: 'success',
            })
        } catch (error) {
            addToast({
                title: 'Failed to add security rule',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setSecurityRuleCreateLoading(false)
        }
    }

    const handleDeleteSecurityRule = async (groupId: number, ruleId: number) => {
        setSecurityRuleDeleteLoadingId(ruleId)
        try {
            await wordpressAPI.deleteComputeSecurityGroupRule(groupId, ruleId)
            await refreshSecurityGroups()
            addToast({
                title: 'Rule deleted',
                description: 'Security rule removed.',
                variant: 'success',
            })
        } catch (error) {
            addToast({
                title: 'Failed to delete rule',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'error',
            })
        } finally {
            setSecurityRuleDeleteLoadingId(null)
        }
    }

    const actionLabel = (action: InstanceAction) => action.charAt(0).toUpperCase() + action.slice(1)

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Breadcrumbs items={[{ label: 'EC2 Service' }]} />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">EC2 Service</h1>
                    <p className="text-gray-600 mt-1">Manage VM lifecycle, key pairs, security policies, and async operations.</p>
                </div>
                <Button variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
                    {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5 border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                            <Server className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Instances</p>
                            <p className="font-semibold text-gray-900">{instances.length} total</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Running</p>
                            <p className="font-semibold text-gray-900">{runningCount} active</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Pending Operations</p>
                            <p className="font-semibold text-gray-900">{pendingOperationCount}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">SSH Keys</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <form className="space-y-3" onSubmit={handleGenerateSSHKey}>
                            <h3 className="font-semibold text-gray-900">Generate New Key Pair</h3>
                            <p className="text-sm text-gray-500">Like AWS EC2: private key is shown/downloaded once.</p>
                            <Input
                                value={sshGenerateForm.name}
                                onChange={(event) => setSshGenerateForm((previous) => ({ ...previous, name: event.target.value }))}
                                placeholder="prod-web-key"
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <select
                                    value={sshGenerateForm.keyType}
                                    onChange={(event) => setSshGenerateForm((previous) => ({ ...previous, keyType: event.target.value as SSHKeyType }))}
                                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
                                >
                                    <option value="ed25519">ed25519 (recommended)</option>
                                    <option value="rsa">rsa</option>
                                </select>
                                <select
                                    value={sshGenerateForm.bits}
                                    onChange={(event) => setSshGenerateForm((previous) => ({ ...previous, bits: Number(event.target.value) }))}
                                    disabled={sshGenerateForm.keyType !== 'rsa'}
                                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2 disabled:bg-gray-100"
                                >
                                    <option value={2048}>RSA 2048</option>
                                    <option value={3072}>RSA 3072</option>
                                    <option value={4096}>RSA 4096</option>
                                </select>
                            </div>
                            <Input
                                value={sshGenerateForm.comment}
                                onChange={(event) => setSshGenerateForm((previous) => ({ ...previous, comment: event.target.value }))}
                                placeholder="optional comment (e.g. dev@team)"
                            />
                            <Button type="submit" variant="primary" disabled={sshGenerateLoading}>
                                {sshGenerateLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                Generate & Download Private Key
                            </Button>
                        </form>

                        <form className="space-y-3" onSubmit={handleImportSSHKey}>
                            <h3 className="font-semibold text-gray-900">Import Existing Public Key</h3>
                            <p className="text-sm text-gray-500">Paste an existing OpenSSH public key.</p>
                            <Input
                                value={sshImportName}
                                onChange={(event) => setSshImportName(event.target.value)}
                                placeholder="existing-key-name"
                            />
                            <textarea
                                value={sshImportPublicKey}
                                onChange={(event) => setSshImportPublicKey(event.target.value)}
                                placeholder="ssh-ed25519 AAAA... user@example"
                                className="w-full min-h-24 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
                            />
                            <Button type="submit" variant="outline" disabled={sshImportLoading}>
                                {sshImportLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                Import Public Key
                            </Button>
                        </form>
                    </div>

                    <div className="rounded-lg border border-gray-200">
                        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                            <p className="text-sm font-semibold text-gray-700">Available SSH Keys ({sshKeys.length})</p>
                        </div>
                        {sshKeys.length === 0 ? (
                            <p className="p-4 text-sm text-gray-500">No keys available for this user.</p>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {sshKeys.map((key) => (
                                    <div key={key.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <KeyRound className="w-4 h-4 text-gray-500" />
                                                <p className="font-medium text-gray-900 truncate">{key.name}</p>
                                                {!key.is_active ? <Badge variant="default">Inactive</Badge> : null}
                                            </div>
                                            <p className="text-xs text-gray-500 font-mono truncate">{key.fingerprint}</p>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={createForm.sshKeyId === key.id ? 'primary' : 'outline'}
                                            onClick={() => setCreateForm((previous) => ({ ...previous, sshKeyId: key.id }))}
                                        >
                                            Use For Launch
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Security Groups & Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    <form className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-end" onSubmit={handleCreateSecurityGroup}>
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                            <Input
                                value={securityGroupCreateForm.name}
                                onChange={(event) => setSecurityGroupCreateForm((previous) => ({ ...previous, name: event.target.value }))}
                                placeholder="web-access"
                            />
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <Input
                                value={securityGroupCreateForm.description}
                                onChange={(event) => setSecurityGroupCreateForm((previous) => ({ ...previous, description: event.target.value }))}
                                placeholder="Allow web traffic"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={securityGroupCreateForm.isDefault}
                                    onChange={(event) => setSecurityGroupCreateForm((previous) => ({ ...previous, isDefault: event.target.checked }))}
                                />
                                Default
                            </label>
                            <Button type="submit" variant="outline" disabled={securityGroupCreateLoading}>
                                {securityGroupCreateLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                Create
                            </Button>
                        </div>
                    </form>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-lg border border-gray-200">
                            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                                <p className="text-sm font-semibold text-gray-700">Security Groups ({securityGroups.length})</p>
                            </div>
                            {securityGroups.length === 0 ? (
                                <p className="p-4 text-sm text-gray-500">No security groups yet. Create one above.</p>
                            ) : (
                                <div className="divide-y divide-gray-200">
                                    {securityGroups.map((group) => (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => setSelectedSecurityGroupId(group.id)}
                                            className={`w-full text-left p-4 transition-colors ${selectedSecurityGroupId === group.id ? 'bg-purple-50' : 'bg-white hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium text-gray-900">{group.name}</p>
                                                <div className="flex items-center gap-2">
                                                    {group.is_default ? <Badge variant="info">Default</Badge> : null}
                                                    <Badge variant="outline">{group.rules?.length || 0} rules</Badge>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{group.description || 'No description'}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <h3 className="font-semibold text-gray-900">
                                {selectedSecurityGroup ? `Rules for ${selectedSecurityGroup.name}` : 'Select a security group'}
                            </h3>
                            <form className="space-y-3 rounded-lg border border-gray-200 p-4" onSubmit={handleCreateSecurityRule}>
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={securityRuleCreateForm.direction}
                                        onChange={(event) => setSecurityRuleCreateForm((previous) => ({ ...previous, direction: event.target.value as RuleDirection }))}
                                        className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
                                    >
                                        <option value="ingress">Ingress</option>
                                        <option value="egress">Egress</option>
                                    </select>
                                    <select
                                        value={securityRuleCreateForm.protocol}
                                        onChange={(event) => setSecurityRuleCreateForm((previous) => ({ ...previous, protocol: event.target.value as RuleProtocol }))}
                                        className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
                                    >
                                        <option value="tcp">TCP</option>
                                        <option value="udp">UDP</option>
                                        <option value="icmp">ICMP</option>
                                        <option value="all">ALL</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        value={securityRuleCreateForm.fromPort}
                                        onChange={(event) => setSecurityRuleCreateForm((previous) => ({ ...previous, fromPort: event.target.value }))}
                                        placeholder="From port"
                                        disabled={securityRuleCreateForm.protocol === 'icmp' || securityRuleCreateForm.protocol === 'all'}
                                    />
                                    <Input
                                        value={securityRuleCreateForm.toPort}
                                        onChange={(event) => setSecurityRuleCreateForm((previous) => ({ ...previous, toPort: event.target.value }))}
                                        placeholder="To port"
                                        disabled={securityRuleCreateForm.protocol === 'icmp' || securityRuleCreateForm.protocol === 'all'}
                                    />
                                </div>

                                <Input
                                    value={securityRuleCreateForm.cidr}
                                    onChange={(event) => setSecurityRuleCreateForm((previous) => ({ ...previous, cidr: event.target.value }))}
                                    placeholder="CIDR, e.g. 0.0.0.0/0"
                                />
                                <Input
                                    value={securityRuleCreateForm.description}
                                    onChange={(event) => setSecurityRuleCreateForm((previous) => ({ ...previous, description: event.target.value }))}
                                    placeholder="Optional description"
                                />

                                <Button type="submit" variant="outline" disabled={securityRuleCreateLoading || !selectedSecurityGroup}>
                                    {securityRuleCreateLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                                    Add Rule
                                </Button>
                            </form>

                            <div className="rounded-lg border border-gray-200">
                                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                                    <p className="text-sm font-semibold text-gray-700">Rules ({securityRules.length})</p>
                                </div>
                                {securityRules.length === 0 ? (
                                    <p className="p-4 text-sm text-gray-500">No rules on selected group.</p>
                                ) : (
                                    <div className="divide-y divide-gray-200">
                                        {securityRules.map((rule) => (
                                            <div key={rule.id} className="p-3 flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {rule.direction.toUpperCase()} {rule.protocol.toUpperCase()} {rule.from_port === null ? 'all' : `${rule.from_port}-${rule.to_port}`}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {rule.cidr}{rule.description ? ` · ${rule.description}` : ''}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => void handleDeleteSecurityRule(selectedSecurityGroupId, rule.id)}
                                                    disabled={securityRuleDeleteLoadingId === rule.id}
                                                >
                                                    {securityRuleDeleteLoadingId === rule.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    )}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Launch Instance</CardTitle>
                </CardHeader>
                <CardContent>
                    {!hasCreateDependencies ? (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                            Missing required resources. Need at least one active image, instance type, and SSH key.
                        </div>
                    ) : null}

                    <form className="space-y-4" onSubmit={handleCreateInstance}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label htmlFor="ec2-instance-name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Name
                                </label>
                                <Input
                                    id="ec2-instance-name"
                                    value={createForm.name}
                                    onChange={(event) => setCreateForm((previous) => ({ ...previous, name: event.target.value }))}
                                    placeholder="web-01"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="ec2-instance-image" className="block text-sm font-medium text-gray-700 mb-1">
                                    Image
                                </label>
                                <select
                                    id="ec2-instance-image"
                                    value={createForm.imageId || ''}
                                    onChange={(event) => setCreateForm((previous) => ({ ...previous, imageId: Number(event.target.value) }))}
                                    disabled={images.length === 0}
                                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
                                >
                                    {images.length === 0 ? (
                                        <option value="">No images available</option>
                                    ) : (
                                        images.map((image) => (
                                            <option key={image.id} value={image.id}>
                                                {image.name} {image.version}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">{images.length} image(s)</p>
                            </div>

                            <div>
                                <label htmlFor="ec2-instance-flavor" className="block text-sm font-medium text-gray-700 mb-1">
                                    Instance Type
                                </label>
                                <select
                                    id="ec2-instance-flavor"
                                    value={createForm.flavorId || ''}
                                    onChange={(event) => setCreateForm((previous) => ({ ...previous, flavorId: Number(event.target.value) }))}
                                    disabled={flavors.length === 0}
                                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
                                >
                                    {flavors.length === 0 ? (
                                        <option value="">No instance types available</option>
                                    ) : (
                                        flavors.map((flavor) => (
                                            <option key={flavor.id} value={flavor.id}>
                                                {flavor.name} ({flavor.vcpu} vCPU, {Math.round(flavor.memory_mb / 1024)} GB RAM)
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">{flavors.length} instance type(s)</p>
                            </div>

                            <div>
                                <label htmlFor="ec2-instance-ssh-key" className="block text-sm font-medium text-gray-700 mb-1">
                                    SSH Key
                                </label>
                                <select
                                    id="ec2-instance-ssh-key"
                                    value={createForm.sshKeyId || ''}
                                    onChange={(event) => setCreateForm((previous) => ({ ...previous, sshKeyId: Number(event.target.value) }))}
                                    disabled={sshKeys.length === 0}
                                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
                                >
                                    {sshKeys.length === 0 ? (
                                        <option value="">No SSH keys available</option>
                                    ) : (
                                        sshKeys.map((key) => (
                                            <option key={key.id} value={key.id}>
                                                {key.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">{sshKeys.length} SSH key(s)</p>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-gray-500" />
                                <p className="text-sm font-medium text-gray-700">Security Groups</p>
                            </div>

                            {securityGroups.length === 0 ? (
                                <p className="text-sm text-gray-500">No security groups found. Create one above.</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {securityGroups.map((group) => (
                                        <label
                                            key={group.id}
                                            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={createForm.securityGroupIds.includes(group.id)}
                                                onChange={(event) => handleSecurityGroupToggle(group.id, event.target.checked)}
                                                className="rounded border-gray-300"
                                            />
                                            <span className="text-sm text-gray-700">
                                                {group.name}
                                                {group.is_default ? ' (default)' : ''}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                                Selected security groups are linked at launch and shown per instance below.
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" variant="primary" disabled={createLoading || !hasCreateDependencies}>
                                {createLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Cpu className="w-4 h-4 mr-2" />}
                                Launch Instance
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Instances</CardTitle>
                </CardHeader>
                <CardContent>
                    {instances.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
                            <Server className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <h3 className="font-semibold text-gray-900">No instances found</h3>
                            <p className="text-sm text-gray-500 mt-1">Launch your first VM using the form above.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>State</TableHead>
                                    <TableHead>Network</TableHead>
                                    <TableHead>Profile</TableHead>
                                    <TableHead>Security Groups</TableHead>
                                    <TableHead>Last Operation</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {instances.map((instance) => {
                                    const operationState = operationsByInstance[instance.id]
                                    const busy = isInstanceBusy(instance)
                                    const running = instance.state === 'running'
                                    const stopped = instance.state === 'stopped'
                                    const terminated = instance.state === 'terminated' || instance.state === 'terminating'

                                    return (
                                        <TableRow key={instance.id}>
                                            <TableCell>
                                                <div className="font-semibold text-gray-900">{instance.name}</div>
                                                <div className="text-xs text-gray-500 font-mono mt-0.5">{instance.instance_id}</div>
                                            </TableCell>

                                            <TableCell>{getStateBadge(instance.state)}</TableCell>

                                            <TableCell className="text-sm">
                                                <div className="text-gray-700">
                                                    Private: <span className="font-mono">{instance.private_ip || '-'}</span>
                                                </div>
                                                <div className="text-gray-500">
                                                    Public: <span className="font-mono">{instance.public_ip || '-'}</span>
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-sm">
                                                <div className="text-gray-700">{instance.image_name} {instance.image_version}</div>
                                                <div className="text-gray-500">{instance.flavor_name}</div>
                                            </TableCell>

                                            <TableCell>
                                                {instance.security_groups && instance.security_groups.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {instance.security_groups.map((group) => (
                                                            <Badge key={group.id} variant="outline">
                                                                {group.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-500">None</span>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                {operationState ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={operationState.terminal ? (operationState.status === 'success' ? 'success' : 'error') : 'warning'}>
                                                                {operationState.operation} {operationState.status}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-gray-500">
                                                            {formatDateTime(new Date(operationState.updatedAt))}
                                                        </p>
                                                        {operationState.error ? (
                                                            <p className="text-xs text-red-600 max-w-xs truncate" title={operationState.error}>
                                                                {operationState.error}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-500">No tracked operation</span>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void queueAction(instance, 'describe')}
                                                        disabled={activeAction?.instanceId === instance.id}
                                                        title={actionLabel('describe')}
                                                    >
                                                        {activeAction?.instanceId === instance.id && activeAction.action === 'describe' ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Search className="w-4 h-4" />
                                                        )}
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void queueAction(instance, 'start')}
                                                        disabled={!stopped || busy || activeAction?.instanceId === instance.id}
                                                        title={actionLabel('start')}
                                                    >
                                                        {activeAction?.instanceId === instance.id && activeAction.action === 'start' ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Play className="w-4 h-4" />
                                                        )}
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void queueAction(instance, 'stop')}
                                                        disabled={!running || busy || activeAction?.instanceId === instance.id}
                                                        title={actionLabel('stop')}
                                                    >
                                                        {activeAction?.instanceId === instance.id && activeAction.action === 'stop' ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Square className="w-4 h-4" />
                                                        )}
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => void queueAction(instance, 'reboot')}
                                                        disabled={!running || busy || activeAction?.instanceId === instance.id}
                                                        title={actionLabel('reboot')}
                                                    >
                                                        {activeAction?.instanceId === instance.id && activeAction.action === 'reboot' ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <RotateCcw className="w-4 h-4" />
                                                        )}
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        onClick={() => void queueAction(instance, 'terminate')}
                                                        disabled={terminated || busy || activeAction?.instanceId === instance.id}
                                                        title={actionLabel('terminate')}
                                                    >
                                                        {activeAction?.instanceId === instance.id && activeAction.action === 'terminate' ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                                {instance.last_error ? (
                                                    <p className="text-xs text-red-600 mt-2 text-right max-w-xs truncate" title={instance.last_error}>
                                                        {instance.last_error}
                                                    </p>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
