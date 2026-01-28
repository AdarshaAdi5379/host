import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header Skeleton */}
            <div>
                <Skeleton className="h-9 w-64 mb-2" />
                <Skeleton className="h-5 w-96" />
            </div>

            {/* Resource Usage Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-48" />
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-12" />
                                    </div>
                                    <Skeleton className="h-2 w-full" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
                <div>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="flex flex-col items-center space-y-2">
                                    <Skeleton className="h-12 w-12 rounded-lg" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Service Cards Skeleton */}
            <div>
                <Skeleton className="h-7 w-48 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-3">
                                        <Skeleton className="h-12 w-12 rounded-lg" />
                                        <div>
                                            <Skeleton className="h-5 w-32 mb-2" />
                                            <Skeleton className="h-4 w-24" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-6 w-16 rounded-full" />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                    <Skeleton className="h-2 w-full" />
                                </div>
                                <Skeleton className="h-10 w-full rounded-lg" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-4">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border-b">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                </div>
            ))}
        </div>
    )
}

export function CardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
            </CardContent>
        </Card>
    )
}
