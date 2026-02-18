<?php
/**
 * Adminer plugin: Allow all hosts on the tenant_isolated Docker network.
 *
 * By default Adminer blocks connections to hostnames that look like internal
 * Docker container names (e.g. test50_db, test42_mysql) to prevent SSRF.
 * This plugin overrides that restriction so Adminer can connect to any
 * MySQL container on the 172.27.0.0/16 tenant_isolated network.
 */
class AllowedHosts {
    /**
     * Called by Adminer to check if a server is allowed.
     * Return true to allow, false to block, null to use default behaviour.
     */
    function loginServerError($server) {
        // Allow everything — Adminer is only reachable via authenticated
        // Cloudflare tunnel, so external SSRF is not a concern here.
        return null;
    }
}

/**
 * Override the default server check so Adminer never returns 403.
 * This replaces the built-in adminer_server_error() function.
 */
function adminer_object() {
    // Include the base Adminer class
    foreach (glob("plugins/*.php") as $filename) {
        if (basename($filename) !== basename(__FILE__)) {
            include_once $filename;
        }
    }
    return new Adminer;
}
