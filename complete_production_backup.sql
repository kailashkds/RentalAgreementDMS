-- COMPLETE PRODUCTION DATABASE BACKUP
-- Run these commands in your production database to get everything

-- ============================================================================
-- PART 1: TABLE STRUCTURES (SCHEMA)
-- ============================================================================

-- Get complete table structures
SELECT 
    'CREATE TABLE ' || table_name || ' (' ||
    string_agg(
        column_name || ' ' || 
        CASE 
            WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
            WHEN data_type = 'integer' THEN 'INTEGER'
            WHEN data_type = 'bigint' THEN 'BIGINT'
            WHEN data_type = 'text' THEN 'TEXT'
            WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
            WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
            WHEN data_type = 'boolean' THEN 'BOOLEAN'
            WHEN data_type = 'jsonb' THEN 'JSONB'
            ELSE UPPER(data_type)
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ', '
    ) || ');' as create_statement
FROM information_schema.columns 
WHERE table_schema = 'public' 
GROUP BY table_name
ORDER BY table_name;

-- ============================================================================
-- PART 2: ALL DATA (COMPLETE INSERTS)
-- ============================================================================

-- ADDRESSES TABLE
SELECT 'INSERT INTO addresses (id, society, area, city, pincode) VALUES ' ||
       string_agg('(' || 
                  quote_literal(id) || ',' ||
                  quote_literal(society) || ',' ||
                  quote_literal(area) || ',' ||
                  quote_literal(city) || ',' ||
                  quote_literal(pincode) || ')', ', ') || ';'
FROM addresses;

-- ADMIN_USERS TABLE
SELECT 'INSERT INTO admin_users (id, username, password, email, role, full_name, created_at, updated_at) VALUES ' ||
       string_agg('(' || 
                  quote_literal(id) || ',' ||
                  quote_literal(username) || ',' ||
                  quote_literal(password) || ',' ||
                  quote_literal(email) || ',' ||
                  quote_literal(role) || ',' ||
                  quote_literal(full_name) || ',' ||
                  quote_literal(created_at::text) || ',' ||
                  quote_literal(updated_at::text) || ')', ', ') || ';'
FROM admin_users;

-- CUSTOMERS TABLE
SELECT 'INSERT INTO customers (id, name, email, phone, password, status, created_at, updated_at) VALUES ' ||
       string_agg('(' || 
                  quote_literal(id) || ',' ||
                  quote_literal(name) || ',' ||
                  quote_literal(email) || ',' ||
                  quote_literal(phone) || ',' ||
                  quote_literal(password) || ',' ||
                  quote_literal(status) || ',' ||
                  quote_literal(created_at::text) || ',' ||
                  quote_literal(updated_at::text) || ')', ', ') || ';'
FROM customers;

-- AGREEMENTS TABLE (MOST IMPORTANT - 133 rows)
SELECT 'INSERT INTO agreements (id, customer_id, property_address, monthly_rent, security_deposit, lease_start_date, lease_end_date, owner_name, tenant_name, status, created_at, updated_at, template_content, form_data, property_documents, owner_documents, tenant_documents) VALUES ' ||
       string_agg('(' || 
                  quote_literal(id) || ',' ||
                  quote_literal(customer_id) || ',' ||
                  quote_literal(property_address) || ',' ||
                  quote_literal(monthly_rent::text) || ',' ||
                  quote_literal(security_deposit::text) || ',' ||
                  quote_literal(lease_start_date::text) || ',' ||
                  quote_literal(lease_end_date::text) || ',' ||
                  quote_literal(owner_name) || ',' ||
                  quote_literal(tenant_name) || ',' ||
                  quote_literal(status) || ',' ||
                  quote_literal(created_at::text) || ',' ||
                  quote_literal(updated_at::text) || ',' ||
                  COALESCE(quote_literal(template_content), 'NULL') || ',' ||
                  COALESCE(quote_literal(form_data::text), 'NULL') || ',' ||
                  COALESCE(quote_literal(property_documents), 'NULL') || ',' ||
                  COALESCE(quote_literal(owner_documents), 'NULL') || ',' ||
                  COALESCE(quote_literal(tenant_documents), 'NULL') || ')', ', ') || ';'
FROM agreements;

-- PROPERTIES TABLE
SELECT 'INSERT INTO properties (id, address, city, state, pincode, property_type, created_at) VALUES ' ||
       string_agg('(' || 
                  quote_literal(id) || ',' ||
                  quote_literal(address) || ',' ||
                  quote_literal(city) || ',' ||
                  quote_literal(state) || ',' ||
                  quote_literal(pincode) || ',' ||
                  quote_literal(property_type) || ',' ||
                  quote_literal(created_at::text) || ')', ', ') || ';'
FROM properties;

-- SOCIETIES TABLE
SELECT 'INSERT INTO societies (id, name, address, city, state, pincode, created_at) VALUES ' ||
       string_agg('(' || 
                  quote_literal(id) || ',' ||
                  quote_literal(name) || ',' ||
                  quote_literal(address) || ',' ||
                  quote_literal(city) || ',' ||
                  quote_literal(state) || ',' ||
                  quote_literal(pincode) || ',' ||
                  quote_literal(created_at::text) || ')', ', ') || ';'
FROM societies;

-- PDF_TEMPLATES TABLE
SELECT 'INSERT INTO pdf_templates (id, name, content, language, created_at, updated_at) VALUES ' ||
       string_agg('(' || 
                  quote_literal(id) || ',' ||
                  quote_literal(name) || ',' ||
                  quote_literal(content) || ',' ||
                  quote_literal(language) || ',' ||
                  quote_literal(created_at::text) || ',' ||
                  quote_literal(updated_at::text) || ')', ', ') || ';'
FROM pdf_templates;

-- SESSIONS TABLE
SELECT 'INSERT INTO sessions (sid, sess, expire) VALUES ' ||
       string_agg('(' || 
                  quote_literal(sid) || ',' ||
                  quote_literal(sess::text) || ',' ||
                  quote_literal(expire::text) || ')', ', ') || ';'
FROM sessions;

-- ============================================================================
-- PART 3: SEQUENCES AND INDEXES (if any)
-- ============================================================================

-- Get sequence current values
SELECT 'SELECT setval(''' || sequence_name || ''', ' || last_value || ');'
FROM information_schema.sequences s
JOIN pg_sequences ps ON s.sequence_name = ps.schemaname||'.'||ps.sequencename
WHERE s.sequence_schema = 'public';

-- ============================================================================
-- INSTRUCTIONS:
-- 1. Copy each SELECT statement above
-- 2. Run them one by one in your production Database Studio
-- 3. Copy the results and save to files:
--    - schema_backup.sql (table structures)
--    - data_backup.sql (all INSERT statements)
-- 4. Combine into one complete backup file
-- ============================================================================