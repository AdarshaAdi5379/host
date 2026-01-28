import { DeploymentStatus } from '@/types/deployment'

/**
 * Validate build command
 */
export function isValidBuildCommand(command: string): boolean {
    if (!command.trim()) return false

    // Common build commands
    const validPrefixes = ['npm', 'yarn', 'pnpm', 'python', 'pip', 'make', 'go', 'cargo', 'mvn', 'gradle']

    return validPrefixes.some((prefix) => command.trim().startsWith(prefix))
}

/**
 * Get status color for deployment status
 */
export function getStatusColor(status: DeploymentStatus): string {
    switch (status) {
        case DeploymentStatus.SUCCESS:
            return 'text-green-600 bg-green-100'
        case DeploymentStatus.FAILED:
            return 'text-red-600 bg-red-100'
        case DeploymentStatus.BUILDING:
            return 'text-yellow-600 bg-yellow-100'
        case DeploymentStatus.PENDING:
            return 'text-gray-600 bg-gray-100'
        case DeploymentStatus.CANCELLED:
            return 'text-gray-600 bg-gray-100'
        default:
            return 'text-gray-600 bg-gray-100'
    }
}

/**
 * Get status badge variant
 */
export function getStatusVariant(status: DeploymentStatus): 'success' | 'error' | 'warning' | 'default' {
    switch (status) {
        case DeploymentStatus.SUCCESS:
            return 'success'
        case DeploymentStatus.FAILED:
            return 'error'
        case DeploymentStatus.BUILDING:
            return 'warning'
        default:
            return 'default'
    }
}

/**
 * Format deployment duration
 */
export function formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`
    } else {
        return `${seconds}s`
    }
}

/**
 * Parse log line and extract level
 */
export function parseLogLine(line: string): { message: string; level: 'info' | 'error' | 'warning' } {
    const lowerLine = line.toLowerCase()

    if (lowerLine.includes('error') || lowerLine.includes('failed')) {
        return { message: line, level: 'error' }
    } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
        return { message: line, level: 'warning' }
    } else {
        return { message: line, level: 'info' }
    }
}

/**
 * Generate mock deployment logs
 */
export function generateMockLogs(): string[] {
    return [
        '🚀 Starting deployment...',
        '📦 Installing dependencies...',
        '⬇️  Downloading packages...',
        '✅ Dependencies installed successfully',
        '🔨 Running build command: npm run build',
        '📝 Compiling TypeScript...',
        '⚡ Bundling with Vite...',
        '🎨 Processing CSS...',
        '🖼️  Optimizing images...',
        '✅ Build completed successfully',
        '📤 Uploading to server...',
        '🌐 Deploying to production...',
        '✅ Deployment successful!',
        '🎉 Your site is now live at https://example.com',
    ]
}

/**
 * Validate output directory path
 */
export function isValidOutputDirectory(path: string): boolean {
    if (!path.trim()) return false

    // Common output directories
    const validDirs = ['dist', 'build', 'out', 'public', '.', './dist', './build', './out']

    return validDirs.includes(path.trim()) || /^\.?\/[\w-/]+$/.test(path.trim())
}
