-- Shared RDS bootstrap plan (review before execution)
-- endpoint: database-1.cz2m4kq4gd4a.ap-south-1.rds.amazonaws.com
SET sql_log_bin = 0;
CREATE USER IF NOT EXISTS 'database-1'@'%' IDENTIFIED BY '<REDACTED_OR_SET_PASSWORD>';
ALTER USER 'database-1'@'%' IDENTIFIED BY 'adarsha5389';
CREATE DATABASE IF NOT EXISTS `wp_test1` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_test1`.* TO 'database-1'@'%';
CREATE DATABASE IF NOT EXISTS `wp_test2` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_test2`.* TO 'database-1'@'%';
CREATE DATABASE IF NOT EXISTS `wp_test3` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_test3`.* TO 'database-1'@'%';
CREATE DATABASE IF NOT EXISTS `wp_shared_site` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_shared_site`.* TO 'database-1'@'%';
CREATE DATABASE IF NOT EXISTS `wp_test4` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_test4`.* TO 'database-1'@'%';
CREATE DATABASE IF NOT EXISTS `wp_test5` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_test5`.* TO 'database-1'@'%';
CREATE DATABASE IF NOT EXISTS `wp_student_crud` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_student_crud`.* TO 'database-1'@'%';
CREATE DATABASE IF NOT EXISTS `wp_kll` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_kll`.* TO 'database-1'@'%';
CREATE DATABASE IF NOT EXISTS `wp_shop` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `wp_shop`.* TO 'database-1'@'%';
FLUSH PRIVILEGES;
