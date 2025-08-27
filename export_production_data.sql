-- COMPLETE PRODUCTION DATA EXPORT SCRIPT
-- Run this in your PRODUCTION database to export ALL data

-- Export ALL customers
\COPY (SELECT * FROM customers) TO 'customers_export.csv' WITH CSV HEADER;

-- Export ALL agreements  
\COPY (SELECT * FROM agreements) TO 'agreements_export.csv' WITH CSV HEADER;

-- Export ALL users
\COPY (SELECT * FROM users) TO 'users_export.csv' WITH CSV HEADER;

-- Export ALL permissions
\COPY (SELECT * FROM permissions) TO 'permissions_export.csv' WITH CSV HEADER;

-- Export ALL roles
\COPY (SELECT * FROM roles) TO 'roles_export.csv' WITH CSV HEADER;

-- Export ALL role_permissions
\COPY (SELECT * FROM role_permissions) TO 'role_permissions_export.csv' WITH CSV HEADER;

-- Export ALL user_roles
\COPY (SELECT * FROM user_roles) TO 'user_roles_export.csv' WITH CSV HEADER;

-- Export ALL societies
\COPY (SELECT * FROM societies) TO 'societies_export.csv' WITH CSV HEADER;

-- Export ALL properties
\COPY (SELECT * FROM properties) TO 'properties_export.csv' WITH CSV HEADER;

-- Export ALL pdf_templates
\COPY (SELECT * FROM pdf_templates) TO 'pdf_templates_export.csv' WITH CSV HEADER;

-- Export ALL addresses
\COPY (SELECT * FROM addresses) TO 'addresses_export.csv' WITH CSV HEADER;

-- Export ALL sessions
\COPY (SELECT * FROM sessions) TO 'sessions_export.csv' WITH CSV HEADER;

-- Export ALL other tables
\COPY (SELECT * FROM admin_users) TO 'admin_users_export.csv' WITH CSV HEADER;
\COPY (SELECT * FROM agreement_templates) TO 'agreement_templates_export.csv' WITH CSV HEADER;
\COPY (SELECT * FROM audit_logs) TO 'audit_logs_export.csv' WITH CSV HEADER;
\COPY (SELECT * FROM customer_roles) TO 'customer_roles_export.csv' WITH CSV HEADER;
\COPY (SELECT * FROM user_permissions) TO 'user_permissions_export.csv' WITH CSV HEADER;
\COPY (SELECT * FROM word_templates) TO 'word_templates_export.csv' WITH CSV HEADER;