import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BreadcrumbItem {
    label: string
    href?: string
    to?: string
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav className="flex items-center space-x-2 text-sm">
            {items.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                    {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                    {item.href || item.to ? (
                        <Link
                            to={item.to || item.href!}
                            className="text-gray-600 hover:text-brand-purple transition-colors"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-gray-900 font-medium">{item.label}</span>
                    )}
                </div>
            ))}
        </nav>
    )
}
