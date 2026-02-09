export interface FileManagerAccess {
    url: string
    path: string
    site_name: string
    disk_usage: {
        used: number
        total: number
        used_mb: number
        used_gb: number
    }
}

const API_BASE = 'http://localhost:8000/api/sites'

export const fileManagerAPI = {
    getAccess: async (siteId: number, token: string): Promise<FileManagerAccess> => {
        const response = await fetch(`${API_BASE}/${siteId}/file_manager/`, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to fetch file manager access')
        }

        return response.json()
    },
}
