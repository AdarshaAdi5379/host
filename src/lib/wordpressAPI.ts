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
    framework?: 'wordpress' | 'react_django';
    repo_url?: string;
    branch?: string;
    build_status?: 'idle' | 'building' | 'deploying' | 'failed' | 'running';
    api_port?: number;
    env_vars?: Record<string, string>;
    replica_count?: number;
    backend_ports?: number[];
    gateway_last_synced_at?: string | null;
    gateway_last_error?: string;
}

export interface ProjectService {
    id: number;
    name: string;
    container_name: string;
    internal_port: number;
    protocol: 'http';
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ApiRoute {
    id: number;
    service: number;
    service_name: string;
    container_name: string;
    internal_port: number;
    path: string;
    strip_prefix: boolean;
    is_enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface GatewayApplyJob {
    id: number;
    status: 'pending' | 'running' | 'success' | 'failed' | 'superseded';
    reason: string;
    error: string;
    worker_id: string;
    scheduled_for: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateSiteRequest {
    name: string;
    admin_username?: string;
    admin_password?: string;
    framework?: 'wordpress' | 'react_django';
    repo_url?: string;
    branch?: string;
    env_vars?: Record<string, string>;
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
    private async checkOkWithBody(response: Response, message: string) {
        if (response.status === 401) {
            handleUnauthorized();
            throw new Error('Session expired. Please log in again.');
        }
        if (!response.ok) {
            let detail = '';
            try {
                const body = await response.clone().json();
                detail = body.detail || body.error || JSON.stringify(body);
            } catch (_) { }
            throw new Error(detail ? `${message}: ${detail}` : `${message} (HTTP ${response.status})`);
        }
    }

    /** Simple sync check for backward compat */
    private checkOk(response: Response, message: string) {
        if (response.status === 401) {
            handleUnauthorized();
            throw new Error('Session expired. Please log in again.');
        }
        if (!response.ok) {
            throw new Error(`${message} (HTTP ${response.status})`);
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
     * Fetch a single site by ID
     */
    async getSite(id: number): Promise<WordPressSite> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        await this.checkOkWithBody(response, `Failed to fetch site ${id}`);
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

    /**
     * Get build logs for a site
     */
    async getBuildLogs(id: number): Promise<{ logs: string }> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/build_logs/`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch build logs');
        }

        return response.json();
    }
    /**
     * Scale the Django backend replicas for a react_django site
     */
    async scaleSite(id: number, replicaCount: number): Promise<{
        replica_count: number;
        backend_ports: number[];
        status: string;
        algorithm: string;
        nginx_reload: string;
        nginx_config_path: string | null;
        docker_output: string | null;
    }> {
        const response = await fetch(`${API_BASE_URL}/sites/${id}/scale/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ replica_count: replicaCount }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to scale site');
        }

        return response.json();
    }

    async getApiServices(siteId: number): Promise<ProjectService[]> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-services/`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        await this.checkOkWithBody(response, 'Failed to fetch API services');
        return response.json();
    }

    async createApiService(siteId: number, payload: {
        name: string;
        container_name: string;
        internal_port: number;
        protocol?: 'http';
        is_active?: boolean;
    }): Promise<ProjectService> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-services/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        await this.checkOkWithBody(response, 'Failed to create API service');
        return response.json();
    }

    async updateApiService(siteId: number, serviceId: number, payload: Partial<{
        name: string;
        container_name: string;
        internal_port: number;
        is_active: boolean;
    }>): Promise<ProjectService> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-services/${serviceId}/`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        await this.checkOkWithBody(response, 'Failed to update API service');
        return response.json();
    }

    async deleteApiService(siteId: number, serviceId: number): Promise<{ status: string; gateway_status?: string }> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-services/${serviceId}/`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        await this.checkOkWithBody(response, 'Failed to delete API service');
        return response.json();
    }

    async getApiRoutes(siteId: number): Promise<ApiRoute[]> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-routes/`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        await this.checkOkWithBody(response, 'Failed to fetch API routes');
        return response.json();
    }

    async createApiRoute(siteId: number, payload: {
        service: number;
        path: string;
        strip_prefix?: boolean;
        is_enabled?: boolean;
    }): Promise<ApiRoute> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-routes/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        await this.checkOkWithBody(response, 'Failed to create API route');
        return response.json();
    }

    async updateApiRoute(siteId: number, routeId: number, payload: Partial<{
        service: number;
        path: string;
        strip_prefix: boolean;
        is_enabled: boolean;
    }>): Promise<ApiRoute> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-routes/${routeId}/`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        await this.checkOkWithBody(response, 'Failed to update API route');
        return response.json();
    }

    async deleteApiRoute(siteId: number, routeId: number): Promise<{ status: string; gateway_status?: string }> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-routes/${routeId}/`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });

        await this.checkOkWithBody(response, 'Failed to delete API route');
        return response.json();
    }

    async getApiGatewayStatus(siteId: number): Promise<{
        last_synced_at: string | null;
        last_error: string;
        config_hash: string;
        latest_job: GatewayApplyJob | null;
    }> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-gateway-status/`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        await this.checkOkWithBody(response, 'Failed to fetch API gateway status');
        return response.json();
    }

    async applyApiGateway(siteId: number): Promise<{ status: string; job: GatewayApplyJob }> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-gateway-apply/`, {
            method: 'POST',
            headers: this.getHeaders(),
        });

        await this.checkOkWithBody(response, 'Failed to queue API gateway apply');
        return response.json();
    }
}

export const wordpressAPI = new WordPressAPI();
