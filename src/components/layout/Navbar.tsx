import { Search, Bell, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export function Navbar() {
    return (
        <div className="h-16 bg-white border-b border-border flex items-center justify-between px-6">
            {/* Search */}
            <div className="flex-1 max-w-xl">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        type="search"
                        placeholder="Search sites, domains, or settings..."
                        className="pl-10 w-full"
                    />
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
                {/* Notifications */}
                <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <Bell className="w-5 h-5 text-gray-600" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {/* User Menu */}
                <div className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                    <div className="w-8 h-8 bg-brand-purple rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="hidden md:block">
                        <p className="text-sm font-semibold">John Doe</p>
                        <p className="text-xs text-gray-500">Premium Plan</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
