/**
 * API Service for WordPress Orchestrator Backend
 */

import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL as BACKEND_BASE_URL } from '@/lib/api/config'

const API_BASE_URL = `${BACKEND_BASE_URL}/api`;

/**
 * Handle globally unauthorized responses: clear the local session so
 * ProtectedRoute redirects the user to /login on the next render.
 * We do NOT use window.location.href to avoid a full page reload which
 * loses React state and causes a flash. ProtectedRoute watches isAuthenticated
 * and will navigate to /login as soon as clearSession() fires.
 * We do NOT call logout() because the token is already rejected — there is
 * nothing to invalidate server-side, and a logout() call would itself return
 * 401 and trigger another handleUnauthorized() loop.
 */
function handleUnauthorized() {
    useAuthStore.getState().clearSession()
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

export interface GatewayDiscoveryContainer {
    container_name: string;
    compose_service: string;
    suggested_service_name: string;
    default_internal_port: number | null;
    recommended_for_api: boolean;
    already_registered: boolean;
    already_registered_for_port: boolean;
}

export interface ComputeImage {
    id: number;
    name: string;
    version: string;
    source_url?: string;
    checksum_sha256?: string;
    local_path: string;
    os_family: string;
    minimum_disk_gb: number;
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface ComputeFlavor {
    id: number;
    name: string;
    vcpu: number;
    memory_mb: number;
    disk_gb: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ComputeSSHKey {
    id: number;
    owner: number;
    name: string;
    public_key: string;
    fingerprint: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ComputeSecurityGroup {
    id: number;
    owner?: number;
    name: string;
    description: string;
    is_default: boolean;
    rules?: Array<{
        id: number;
        direction: 'ingress' | 'egress';
        protocol: 'tcp' | 'udp' | 'icmp' | 'all';
        from_port: number | null;
        to_port: number | null;
        cidr: string;
        description: string;
        is_active: boolean;
    }>;
    created_at: string;
    updated_at: string;
}

export interface ComputeSecurityGroupRule {
    id: number;
    security_group: number;
    direction: 'ingress' | 'egress';
    protocol: 'tcp' | 'udp' | 'icmp' | 'all';
    from_port: number | null;
    to_port: number | null;
    cidr: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ComputeInstance {
    id: number;
    name: string;
    instance_id: string;
    state: string;
    desired_state: string;
    private_ip: string | null;
    public_ip: string | null;
    image: number;
    image_name: string;
    image_version: string;
    flavor: number;
    flavor_name: string;
    ssh_key: number | null;
    ssh_key_name: string | null;
    security_groups?: ComputeSecurityGroup[];
    last_error: string;
    launched_at: string | null;
    terminated_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ComputeOperation {
    id: number;
    instance: number;
    instance_id: string;
    instance_name: string;
    operation: 'create' | 'start' | 'stop' | 'reboot' | 'terminate' | 'describe' | 'reconcile';
    status: 'pending' | 'running' | 'success' | 'failed' | 'superseded' | 'cancelled';
    request_payload: Record<string, unknown>;
    result_payload: Record<string, unknown>;
    idempotency_key: string;
    attempt_count: number;
    max_attempts: number;
    retry_backoff_seconds: number;
    can_retry: boolean;
    error: string;
    worker_id: string;
    requested_by: number | null;
    requested_by_username: string | null;
    scheduled_for: string;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ComputeOperationPollResponse {
    operation: ComputeOperation;
    status: ComputeOperation['status'];
    terminal: boolean;
    poll_after_seconds: number;
}

export interface ComputeGeneratedSSHKeyResponse {
    status: 'created';
    key: ComputeSSHKey;
    public_key: string;
    private_key: string;
    download_filename: string;
    key_type: 'ed25519' | 'rsa';
    bits?: number;
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
            const token = useAuthStore.getState().token
            console.error('[API] 401 Unauthorized on', message, '| token in store:', token ? token.slice(0,8)+'...' : 'NULL')
            handleUnauthorized();
            throw new Error('Session expired. Please log in again.');
        }
        if (!response.ok) {
            let detail = '';
            try {
                const body = await response.clone().json();
                if (body?.detail) {
                    detail = body.detail;
                } else if (body?.error) {
                    detail = typeof body.error === 'string'
                        ? body.error
                        : (body.error.message || JSON.stringify(body.error));
                } else {
                    detail = JSON.stringify(body);
                }
            } catch (_) { }
            throw new Error(detail ? `${message}: ${detail}` : `${message} (HTTP ${response.status})`);
        }
    }

    private async toJsonArray<T>(response: Response, message: string): Promise<T[]> {
        await this.checkOkWithBody(response, message);
        const payload = await response.json();
        if (Array.isArray(payload)) {
            return payload;
        }
        if (payload && Array.isArray(payload.results)) {
            return payload.results;
        }
        throw new Error(`${message}: unexpected response shape`);
    }

    /** Simple sync check for backward compat */
    private checkOk(response: Response, message: string) {
        if (response.status === 401) {
            const token = useAuthStore.getState().token
            console.error('[API] 401 Unauthorized on', message, '| token in store:', token ? token.slice(0,8)+'...' : 'NULL')
            handleUnauthorized();
            throw new Error('Session expired. Please log in again.');
        }
        if (!response.ok) {
            throw new Error(`${message} (HTTP ${response.status})`);
        }
    }

    private withCacheBuster(url: string): string {
        const divider = url.includes('?') ? '&' : '?';
        return `${url}${divider}_ts=${Date.now()}`;
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

        await this.checkOkWithBody(response, 'Failed to start site');
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

        await this.checkOkWithBody(response, 'Failed to fetch aggregate stats');

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

    async getApiGatewayDiscovery(siteId: number): Promise<{ containers: GatewayDiscoveryContainer[] }> {
        const response = await fetch(`${API_BASE_URL}/sites/${siteId}/api-gateway-discovery/`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        await this.checkOkWithBody(response, 'Failed to fetch running project containers');
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

    // Compute (EC2-style) endpoints
    async getComputeImages(): Promise<ComputeImage[]> {
        const response = await fetch(this.withCacheBuster(`${API_BASE_URL}/compute-images/`), {
            method: 'GET',
            headers: this.getHeaders(),
            cache: 'no-store',
        });
        return this.toJsonArray<ComputeImage>(response, 'Failed to fetch compute images');
    }

    async createComputeImage(payload: {
        name: string;
        version?: string;
        local_path: string;
        os_family?: 'ubuntu' | 'debian' | 'centos' | 'rocky' | 'other';
        minimum_disk_gb?: number;
        is_active?: boolean;
        is_default?: boolean;
        source_url?: string;
        checksum_sha256?: string;
    }): Promise<ComputeImage> {
        const response = await fetch(`${API_BASE_URL}/compute-images/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        await this.checkOkWithBody(response, 'Failed to create image');
        return response.json();
    }

    async getComputeFlavors(): Promise<ComputeFlavor[]> {
        const response = await fetch(this.withCacheBuster(`${API_BASE_URL}/compute-flavors/`), {
            method: 'GET',
            headers: this.getHeaders(),
            cache: 'no-store',
        });
        return this.toJsonArray<ComputeFlavor>(response, 'Failed to fetch instance types');
    }

    async createComputeFlavor(payload: {
        name: string;
        vcpu: number;
        memory_mb: number;
        disk_gb: number;
        is_active?: boolean;
    }): Promise<ComputeFlavor> {
        const response = await fetch(`${API_BASE_URL}/compute-flavors/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        await this.checkOkWithBody(response, 'Failed to create instance type');
        return response.json();
    }

    async getComputeSSHKeys(): Promise<ComputeSSHKey[]> {
        const response = await fetch(this.withCacheBuster(`${API_BASE_URL}/ssh-keys/`), {
            method: 'GET',
            headers: this.getHeaders(),
            cache: 'no-store',
        });
        return this.toJsonArray<ComputeSSHKey>(response, 'Failed to fetch SSH keys');
    }

    async createComputeSSHKey(payload: {
        name: string;
        public_key: string;
    }): Promise<ComputeSSHKey> {
        const response = await fetch(`${API_BASE_URL}/ssh-keys/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        await this.checkOkWithBody(response, 'Failed to create SSH key');
        return response.json();
    }

    async generateComputeSSHKey(payload: {
        name: string;
        key_type?: 'ed25519' | 'rsa';
        comment?: string;
        bits?: number;
    }): Promise<ComputeGeneratedSSHKeyResponse> {
        const response = await fetch(`${API_BASE_URL}/ssh-keys/generate/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        await this.checkOkWithBody(response, 'Failed to generate SSH key');
        return response.json();
    }

    async getComputeSecurityGroups(): Promise<ComputeSecurityGroup[]> {
        const response = await fetch(this.withCacheBuster(`${API_BASE_URL}/security-groups/`), {
            method: 'GET',
            headers: this.getHeaders(),
            cache: 'no-store',
        });
        return this.toJsonArray<ComputeSecurityGroup>(response, 'Failed to fetch security groups');
    }

    async createComputeSecurityGroup(payload: {
        name: string;
        description?: string;
        is_default?: boolean;
    }): Promise<ComputeSecurityGroup> {
        const response = await fetch(`${API_BASE_URL}/security-groups/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        await this.checkOkWithBody(response, 'Failed to create security group');
        return response.json();
    }

    async createComputeSecurityGroupRule(
        securityGroupId: number,
        payload: {
            direction: 'ingress' | 'egress';
            protocol: 'tcp' | 'udp' | 'icmp' | 'all';
            from_port?: number | null;
            to_port?: number | null;
            cidr: string;
            description?: string;
            is_active?: boolean;
        }
    ): Promise<ComputeSecurityGroupRule> {
        const response = await fetch(`${API_BASE_URL}/security-groups/${securityGroupId}/rules/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        await this.checkOkWithBody(response, 'Failed to create security group rule');
        return response.json();
    }

    async deleteComputeSecurityGroupRule(securityGroupId: number, ruleId: number): Promise<{ status: string }> {
        const response = await fetch(`${API_BASE_URL}/security-groups/${securityGroupId}/rules/${ruleId}/`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });
        await this.checkOkWithBody(response, 'Failed to delete security group rule');
        return response.json();
    }

    async getComputeInstances(): Promise<ComputeInstance[]> {
        const response = await fetch(this.withCacheBuster(`${API_BASE_URL}/compute-instances/`), {
            method: 'GET',
            headers: this.getHeaders(),
            cache: 'no-store',
        });
        return this.toJsonArray<ComputeInstance>(response, 'Failed to fetch compute instances');
    }

    async createComputeInstance(payload: {
        name: string;
        image_id: number;
        flavor_id: number;
        ssh_key_id: number;
        security_group_ids?: number[];
        metadata?: Record<string, unknown>;
    }): Promise<{ status: string; instance: ComputeInstance; operation: ComputeOperation }> {
        const response = await fetch(`${API_BASE_URL}/compute-instances/`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        await this.checkOkWithBody(response, 'Failed to create compute instance');
        return response.json();
    }

    async queueComputeInstanceAction(
        instanceId: number,
        action: 'start' | 'stop' | 'reboot' | 'terminate' | 'describe',
        idempotencyKey: string = '',
    ): Promise<{ status: string; instance_id: string; operation: ComputeOperation }> {
        const headers = {
            ...this.getHeaders(),
            ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        };
        const response = await fetch(`${API_BASE_URL}/compute-instances/${instanceId}/${action}/`, {
            method: 'POST',
            headers,
        });
        await this.checkOkWithBody(response, `Failed to queue ${action} operation`);
        return response.json();
    }

    async pollComputeOperation(operationId: number): Promise<ComputeOperationPollResponse> {
        const response = await fetch(`${API_BASE_URL}/compute-operations/${operationId}/poll/`, {
            method: 'GET',
            headers: this.getHeaders(),
            cache: 'no-store',
        });
        await this.checkOkWithBody(response, 'Failed to poll compute operation');
        return response.json();
    }

    async getComputeInstanceOperationStatus(instanceId: number, operationId?: number): Promise<ComputeOperationPollResponse> {
        const query = operationId ? `?operation_id=${operationId}` : '';
        const response = await fetch(`${API_BASE_URL}/compute-instances/${instanceId}/operation-status/${query}`, {
            method: 'GET',
            headers: this.getHeaders(),
            cache: 'no-store',
        });
        await this.checkOkWithBody(response, 'Failed to fetch compute instance operation status');
        return response.json();
    }
}

export const wordpressAPI = new WordPressAPI();
