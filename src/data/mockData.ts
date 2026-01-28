// Mock data for development
export interface Service {
    id: string
    type: 'hosting' | 'domain' | 'email'
    name: string
    status: 'active' | 'pending' | 'suspended' | 'expired'
    plan?: string
    renewalDate?: string
    diskUsed?: number
    diskTotal?: number
    pointsTo?: string
    mailboxCount?: number
    storageUsed?: number
    storageTotal?: number
}

export interface ResourceUsage {
    cpu: number
    ram: number
    disk: number
    bandwidth: number
}

export interface DNSRecord {
    id: string
    type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS'
    name: string
    value: string
    ttl: number
    priority?: number
}

export interface Database {
    id: string
    name: string
    size: number
    tables: number
    users: string[]
}

export interface FileItem {
    id: string
    name: string
    type: 'file' | 'directory'
    size?: number
    modified: string
    path: string
}

// Mock Services
export const mockServices: Service[] = [
    {
        id: '1',
        type: 'hosting',
        name: 'mywebsite.com',
        status: 'active',
        plan: 'Premium Hosting',
        renewalDate: '2026-06-15',
        diskUsed: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
        diskTotal: 10 * 1024 * 1024 * 1024, // 10 GB
    },
    {
        id: '2',
        type: 'hosting',
        name: 'blog.example.com',
        status: 'active',
        plan: 'Business Hosting',
        renewalDate: '2026-04-20',
        diskUsed: 5.2 * 1024 * 1024 * 1024, // 5.2 GB
        diskTotal: 20 * 1024 * 1024 * 1024, // 20 GB
    },
    {
        id: '3',
        type: 'domain',
        name: 'mywebsite.com',
        status: 'active',
        renewalDate: '2026-12-01',
        pointsTo: '192.168.1.1',
    },
    {
        id: '4',
        type: 'domain',
        name: 'example.org',
        status: 'active',
        renewalDate: '2026-08-15',
        pointsTo: '192.168.1.2',
    },
    {
        id: '5',
        type: 'email',
        name: 'mywebsite.com',
        status: 'active',
        mailboxCount: 5,
        storageUsed: 1.2 * 1024 * 1024 * 1024, // 1.2 GB
        storageTotal: 5 * 1024 * 1024 * 1024, // 5 GB
    },
]

// Mock Resource Usage
export const mockResourceUsage: ResourceUsage = {
    cpu: 35,
    ram: 62,
    disk: 45,
    bandwidth: 28,
}

// Mock DNS Records
export const mockDNSRecords: DNSRecord[] = [
    {
        id: '1',
        type: 'A',
        name: '@',
        value: '192.168.1.1',
        ttl: 3600,
    },
    {
        id: '2',
        type: 'A',
        name: 'www',
        value: '192.168.1.1',
        ttl: 3600,
    },
    {
        id: '3',
        type: 'CNAME',
        name: 'blog',
        value: 'mywebsite.com',
        ttl: 3600,
    },
    {
        id: '4',
        type: 'MX',
        name: '@',
        value: 'mail.mywebsite.com',
        ttl: 3600,
        priority: 10,
    },
    {
        id: '5',
        type: 'TXT',
        name: '@',
        value: 'v=spf1 include:_spf.google.com ~all',
        ttl: 3600,
    },
]

// Mock Databases
export const mockDatabases: Database[] = [
    {
        id: '1',
        name: 'wordpress_db',
        size: 45 * 1024 * 1024, // 45 MB
        tables: 12,
        users: ['wp_user', 'admin'],
    },
    {
        id: '2',
        name: 'analytics_db',
        size: 120 * 1024 * 1024, // 120 MB
        tables: 8,
        users: ['analytics_user'],
    },
]

// Mock Files
export const mockFiles: FileItem[] = [
    {
        id: '1',
        name: 'public_html',
        type: 'directory',
        modified: '2026-01-20T10:30:00Z',
        path: '/public_html',
    },
    {
        id: '2',
        name: 'index.html',
        type: 'file',
        size: 4096,
        modified: '2026-01-25T14:20:00Z',
        path: '/public_html/index.html',
    },
    {
        id: '3',
        name: 'wp-content',
        type: 'directory',
        modified: '2026-01-22T09:15:00Z',
        path: '/public_html/wp-content',
    },
    {
        id: '4',
        name: 'style.css',
        type: 'file',
        size: 8192,
        modified: '2026-01-24T16:45:00Z',
        path: '/public_html/wp-content/themes/style.css',
    },
]

// Mock Apps for Installer
export interface App {
    id: string
    name: string
    description: string
    icon: string
    category: string
    version: string
}

export const mockApps: App[] = [
    {
        id: '1',
        name: 'WordPress',
        description: 'The world\'s most popular CMS platform',
        icon: '📝',
        category: 'CMS',
        version: '6.4.2',
    },
    {
        id: '2',
        name: 'Laravel',
        description: 'Modern PHP framework for web artisans',
        icon: '🔷',
        category: 'Framework',
        version: '10.x',
    },
    {
        id: '3',
        name: 'Joomla',
        description: 'Flexible content management system',
        icon: '🌟',
        category: 'CMS',
        version: '5.0',
    },
    {
        id: '4',
        name: 'PrestaShop',
        description: 'Open-source e-commerce solution',
        icon: '🛒',
        category: 'E-commerce',
        version: '8.1',
    },
]
