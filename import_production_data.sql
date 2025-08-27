-- IMPORT PRODUCTION DATA INTO LOCAL DATABASE
-- Run this in your LOCAL database after exporting from production

-- Clear existing data (optional - be careful!)
-- TRUNCATE customers, agreements, users, permissions, roles, role_permissions, user_roles, societies, properties, pdf_templates, addresses, sessions, admin_users, agreement_templates, audit_logs, customer_roles, user_permissions, word_templates CASCADE;

-- Import customers
\COPY customers FROM 'customers_export.csv' WITH CSV HEADER;

-- Import users first (they may be referenced by other tables)
\COPY users FROM 'users_export.csv' WITH CSV HEADER;

-- Import permissions and roles
\COPY permissions FROM 'permissions_export.csv' WITH CSV HEADER;
\COPY roles FROM 'roles_export.csv' WITH CSV HEADER;
\COPY role_permissions FROM 'role_permissions_export.csv' WITH CSV HEADER;
\COPY user_roles FROM 'user_roles_export.csv' WITH CSV HEADER;

-- Import reference data
\COPY societies FROM 'societies_export.csv' WITH CSV HEADER;
\COPY properties FROM 'properties_export.csv' WITH CSV HEADER;
\COPY addresses FROM 'addresses_export.csv' WITH CSV HEADER;

-- Import templates
\COPY pdf_templates FROM 'pdf_templates_export.csv' WITH CSV HEADER;
\COPY agreement_templates FROM 'agreement_templates_export.csv' WITH CSV HEADER;
\COPY word_templates FROM 'word_templates_export.csv' WITH CSV HEADER;

-- Import main data
\COPY agreements FROM 'agreements_export.csv' WITH CSV HEADER;

-- Import admin and audit data
\COPY admin_users FROM 'admin_users_export.csv' WITH CSV HEADER;
\COPY audit_logs FROM 'audit_logs_export.csv' WITH CSV HEADER;
\COPY customer_roles FROM 'customer_roles_export.csv' WITH CSV HEADER;
\COPY user_permissions FROM 'user_permissions_export.csv' WITH CSV HEADER;

-- Import sessions (optional)
\COPY sessions FROM 'sessions_export.csv' WITH CSV HEADER;