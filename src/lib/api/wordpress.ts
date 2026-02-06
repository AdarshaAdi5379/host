const API_BASE = 'http://localhost:8000/api/sites'

export interface DatabaseCredentials {
    host: string
    database: string
    username: string
    password: string
    port: number
    adminer_url: string
    container_name: string
}

export const wordpressAPI = {
    // Get database credentials for a site
    getDatabaseCredentials: async (siteId: number, token: string): Promise<DatabaseCredentials> => {
        const response = await fetch(`${API_BASE}/${siteId}/database/`, {
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            },
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to fetch database credentials')
        }

        return response.json()
    },
}
