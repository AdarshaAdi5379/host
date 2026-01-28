import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bell, User, Settings, LogOut, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { generateInitialsAvatar } from '@/lib/identicon'

export function Navbar() {
    const navigate = useNavigate()
    const { user, logout } = useAuthStore()
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const fallbackAvatar = user ? generateInitialsAvatar(user.name) : null

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
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-purple flex items-center justify-center">
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : fallbackAvatar ? (
                                <img src={fallbackAvatar} alt={user?.name} className="w-full h-full" />
                            ) : (
                                <User className="w-4 h-4 text-white" />
                            )}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-semibold">{user?.name || 'User'}</p>
                            <p className="text-xs text-gray-500 capitalize">{user?.role || 'Member'}</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                            <div className="px-4 py-3 border-b border-gray-200">
                                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                                <p className="text-xs text-gray-500">{user?.email}</p>
                            </div>

                            <button
                                onClick={() => {
                                    navigate('/settings/general')
                                    setIsDropdownOpen(false)
                                }}
                                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                                <span>Settings</span>
                            </button>

                            <div className="border-t border-gray-200 my-2"></div>

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Logout</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
