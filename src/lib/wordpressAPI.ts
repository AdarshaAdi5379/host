/**
 * API Service for WordPress Orchestrator Backend
 */

const API_BASE_URL = 'http://localhost:8000/api';

export interface WordPressSite {
    id: number;
    name: string;
    domain: string;
    port: number;
    status: 'provisioning' | 'running' | 'stopped' | 'error';
    created_at: string;
    updated_at: string;
    admin_username: string;
    tunnel_url?: string;
    tunnel_active: boolean;
}

export interface CreateSiteRequest {
    name: string;
    admin_username: string;
    admin_password: string;
}

class WordPressAPI {
    /**
     * Fetch all WordPress sites
     */
    async getSites(): Promise<WordPressSite[]> {
        const response = await fetch(`${API_BASE_URL}/sites/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch sites');
        }

        return response.json();
    }

    /**
     * Create a new WordPress site
     */
    async createSite(data: CreateSiteRequest): Promise<WordPressSite> {
        const response = await fetch(`${API_BASE_URL}/sites/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create site');
        }

        return response.json();
    }

    /**
     * Start a WordPress site
     */
    async startSite(id: number): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/start/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to start site');
        }
    }

    /**
     * Stop a WordPress site
     */
    async stopSite(id: number): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/stop/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to stop site');
        }
    }

    /**
     * Delete a WordPress site
     */
    async deleteSite(id: number): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/terminate/`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to delete site');
        }
    }

    /**
     * Start a Cloudflare tunnel for a site
     */
    async startTunnel(id: number): Promise<{ tunnel_url: string; status: string }> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/start_tunnel/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to start tunnel');
        }

        return response.json();
    }

    /**
     * Stop a Cloudflare tunnel for a site
     */
    async stopTunnel(id: number): Promise<{ status: string }> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/stop_tunnel/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to stop tunnel');
        }

        return response.json();
    }

    /**
     * Get aggregated resource usage statistics from all sites
     */
    async getAggregateStats(): Promise<{
        cpu: number;
        ram: number;
        total_sites: number;
        running_sites: number;
        sites_with_stats: number;
    }> {
        const response = await fetch(`${API_BASE_URL}/sites/aggregate_stats/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch aggregate stats');
        }

        return response.json();
    }
}

export const wordpressAPI = new WordPressAPI();
