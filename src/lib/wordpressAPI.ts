/**
 * API Service for WordPress Orchestrator Backend
 */

import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Handle globally unauthorized responses: clear the stale token and
 * redirect to /login so the user can re-authenticate.
 */
function handleUnauthorized() {
    useAuthStore.getState().logout()
    // Use window.location so this works outside React component tree
    if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
    }
}

export interface WordPressSite {
    id: number;
    name: string;
    domain: string;
    port: number;
    status: 'provisioning' | 'running' | 'stopped' | 'error';
    created_at: string;
    updated_at: string;
    admin_username: string;
    subdomain?: string;
    public_url?: string;
    public_access_enabled: boolean;
}

export interface CreateSiteRequest {
    name: string;
    admin_username: string;
    admin_password: string;
}

class WordPressAPI {
    private getHeaders(): HeadersInit {
        const token = useAuthStore.getState().token;
        return {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Token ${token}` } : {}),
        };
    }

    /** Throw on error; trigger logout+redirect on 401 */
    private checkOk(response: Response, message: string) {
        if (response.status === 401) {
            handleUnauthorized();
            throw new Error('Session expired. Please log in again.');
        }
        if (!response.ok) {
            throw new Error(message);
        }
    }

    /**
     * Fetch all WordPress sites
     */
    async getSites(): Promise<WordPressSite[]> {
        const response = await fetch(`${API_BASE_URL}/sites/`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        this.checkOk(response, 'Failed to fetch sites');
        return response.json();
    }

    /**
     * Create a new WordPress site
     */
    async createSite(data: CreateSiteRequest): Promise<WordPressSite> {
        const response = await fetch(`${API_BASE_URL}/sites/`, {
            method: 'POST',
            headers: this.getHeaders(),
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
            headers: this.getHeaders(),
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
            headers: this.getHeaders(),
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
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to delete site');
        }
    }

    /**
     * Enable public access for a site (Cloudflare Tunnel)
     */
    async enablePublicAccess(id: number): Promise<{ public_url: string; subdomain: string; status: string }> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/enable_public_access/`, {
            method: 'POST',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to enable public access');
        }

        return response.json();
    }

    /**
     * Disable public access for a site
     */
    async disablePublicAccess(id: number): Promise<{ status: string }> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/disable_public_access/`, {
            method: 'POST',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to disable public access');
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
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch aggregate stats');
        }

        return response.json();
    }

    /**
     * Get FileBrowser credentials for a site
     */
    async getFileBrowserCredentials(id: number): Promise<{
        username: string;
        password: string;
        url: string;
    }> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/filebrowser_credentials/`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch FileBrowser credentials');
        }

        return response.json();
    }
}

export const wordpressAPI = new WordPressAPI();
