import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'

export function AppLayout() {
    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Navbar */}
                <Navbar />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto bg-background custom-scrollbar">
                    <div className="max-w-content mx-auto p-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
