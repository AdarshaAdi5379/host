import { useState, useEffect, useCallback } from 'react'

interface RateLimitState {
    attempts: number
    lockedUntil: number | null
    isLocked: boolean
    remainingTime: number
}

export function useRateLimit(maxAttempts: number = 5, lockDuration: number = 60000) {
    const [state, setState] = useState<RateLimitState>({
        attempts: 0,
        lockedUntil: null,
        isLocked: false,
        remainingTime: 0,
    })

    // Check if still locked
    useEffect(() => {
        if (!state.lockedUntil) return

        const checkLock = () => {
            const now = Date.now()
            if (now >= state.lockedUntil!) {
                setState({
                    attempts: 0,
                    lockedUntil: null,
                    isLocked: false,
                    remainingTime: 0,
                })
            } else {
                setState((prev) => ({
                    ...prev,
                    remainingTime: Math.ceil((prev.lockedUntil! - now) / 1000),
                }))
            }
        }

        checkLock()
        const interval = setInterval(checkLock, 1000)

        return () => clearInterval(interval)
    }, [state.lockedUntil])

    const recordAttempt = useCallback(() => {
        setState((prev) => {
            const newAttempts = prev.attempts + 1

            if (newAttempts >= maxAttempts) {
                const lockedUntil = Date.now() + lockDuration
                return {
                    attempts: newAttempts,
                    lockedUntil,
                    isLocked: true,
                    remainingTime: Math.ceil(lockDuration / 1000),
                }
            }

            return {
                ...prev,
                attempts: newAttempts,
            }
        })
    }, [maxAttempts, lockDuration])

    const reset = useCallback(() => {
        setState({
            attempts: 0,
            lockedUntil: null,
            isLocked: false,
            remainingTime: 0,
        })
    }, [])

    return {
        attempts: state.attempts,
        isLocked: state.isLocked,
        remainingTime: state.remainingTime,
        recordAttempt,
        reset,
    }
}
