# RDS Setup TODO (Pending Items)

Last Updated: 2026-03-03

## 1) Finish Network Path for External Replication (Critical)
- [ ] Confirm router/NAT port-forward exists: `WAN 13306 -> <host_lan_ip>:13306` (TCP).
- [ ] Confirm ISP is not using CGNAT (router WAN IP must equal `curl -4 ifconfig.me`).
- [ ] Keep host firewall open for replication port until stable:
  - [ ] `sudo ufw allow 13306/tcp`
  - [ ] `sudo ufw status verbose`
- [ ] Re-check RDS replica state after network fix:
  - [ ] `MYSQL_PWD='<rds_pass>' mysql -h <rds_endpoint> -P 3306 -u <rds_user> -D mysql -e "CALL mysql.rds_start_replication; SHOW REPLICA STATUS\\G"`
  - [ ] Target: `Replica_IO_Running: Yes` and `Replica_SQL_Running: Yes`.

## 2) Validate Data Replication (shop)
- [ ] Insert a test row on local source DB (`shop_db`, database `wordpress`).
- [ ] Verify the same row appears on RDS `wordpress` DB.
- [ ] Record test timestamp and result in ops notes.

## 3) Harden Security After Replication Works
- [ ] Rotate exposed credentials immediately:
  - [ ] RDS master/app password
  - [ ] replication user password (`replicator`)
- [ ] Update platform DR config with rotated secrets:
  - [ ] `python manage.py rds_failover --site shop --action configure --rds-password '<new>' --replication-password '<new>'`
- [ ] Restrict MySQL ingress from `Anywhere` to least-privilege source(s).
- [ ] Remove/lock temporary broad rules used for debugging.

## 4) Shared RDS Rollout for Remaining Sites
- [ ] Generate shared SQL bootstrap for all sites:
  - [ ] `python manage.py rds_failover --action shared_plan --rds-endpoint '<endpoint>' --rds-username '<user>' --rds-password '<pass>' --database-template 'wp_{site_name}' --write-shared-plan-file ./shared_rds_bootstrap.sql`
- [ ] Execute `shared_rds_bootstrap.sql` on RDS.
- [ ] Apply shared DR config to all sites:
  - [ ] `python manage.py rds_failover --action configure_shared --enabled true --rds-endpoint '<endpoint>' --rds-port 3306 --rds-username '<user>' --rds-password '<pass>' --source-public-host '<public_ip>' --source-public-port <per-site-port-or-standard> --replication-user 'replicator' --replication-password '<repl-pass>' --rds-ssl-required true --database-template 'wp_{site_name}'`
- [ ] For each existing site, ensure source DB has replication prerequisites:
  - [ ] `server_id`, `log_bin`, `binlog_format=ROW` enabled
  - [ ] deterministic externally reachable source port (not `127.0.0.1:0:3306`)

## 5) Controlled Failover/Failback Testing (Staging First)
- [ ] Failover test:
  - [ ] `python manage.py rds_failover --site <site> --action failover`
  - [ ] Verify app can read/write via RDS.
- [ ] Failback test:
  - [ ] Ensure local DB is resynced from RDS before failback.
  - [ ] `python manage.py rds_failover --site <site> --action failback`
  - [ ] Verify application consistency after switchback.

## 6) Monitoring & Runbook
- [ ] Add scheduled health check for replication status (`SHOW REPLICA STATUS\G` parse).
- [ ] Alert on:
  - [ ] `Replica_IO_Running != Yes`
  - [ ] `Replica_SQL_Running != Yes`
  - [ ] replication lag abnormal (if available).
- [ ] Document operator runbook for:
  - [ ] replication bootstrap
  - [ ] failover trigger
  - [ ] failback prerequisites
  - [ ] credential rotation procedure
