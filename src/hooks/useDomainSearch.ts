import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { checkDomainAvailability, isValidDomainName } from '@/lib/domainUtils'
import type { Domain } from '@/types/domain'

export function useDomainSearch(searchTerm: string) {
    // Debounce search term by 500ms
    const [debouncedSearch] = useDebounce(searchTerm, 500)

    const { data, isLoading, error } = useQuery<Domain[]>({
        queryKey: ['domain-search', debouncedSearch],
        queryFn: () => checkDomainAvailability(debouncedSearch),
        enabled: debouncedSearch.length > 0 && isValidDomainName(debouncedSearch),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })

    return {
        results: data || [],
        isLoading: isLoading && debouncedSearch.length > 0,
        error,
        isValid: isValidDomainName(debouncedSearch),
    }
}
