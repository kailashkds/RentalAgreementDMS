-- Run these commands in your PRODUCTION database SQL runner to get complete dump

-- Get all tables data as INSERT statements
-- Copy and paste each result to build your dump file

-- 1. Export all agreements
SELECT 'INSERT INTO agreements VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(customer_id) || ',' ||
       quote_literal(property_address) || ',' ||
       quote_literal(monthly_rent) || ',' ||
       quote_literal(security_deposit) || ',' ||
       quote_literal(lease_start_date) || ',' ||
       quote_literal(lease_end_date) || ',' ||
       quote_literal(owner_name) || ',' ||
       quote_literal(tenant_name) || ',' ||
       quote_literal(status) || ',' ||
       quote_literal(created_at) || ',' ||
       quote_literal(updated_at) || ',' ||
       COALESCE(quote_literal(template_content), 'NULL') || ',' ||
       COALESCE(quote_literal(form_data::text), 'NULL') || ',' ||
       COALESCE(quote_literal(property_documents), 'NULL') || ',' ||
       COALESCE(quote_literal(owner_documents), 'NULL') || ',' ||
       COALESCE(quote_literal(tenant_documents), 'NULL') ||
       ');' as insert_statement
FROM agreements;

-- 2. Export all customers  
SELECT 'INSERT INTO customers VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(name) || ',' ||
       quote_literal(email) || ',' ||
       quote_literal(phone) || ',' ||
       quote_literal(password) || ',' ||
       quote_literal(status) || ',' ||
       quote_literal(created_at) || ',' ||
       quote_literal(updated_at) ||
       ');' as insert_statement
FROM customers;

-- 3. Export all users
SELECT 'INSERT INTO users VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(username) || ',' ||
       quote_literal(password) || ',' ||
       quote_literal(email) || ',' ||
       quote_literal(role) || ',' ||
       quote_literal(full_name) || ',' ||
       quote_literal(phone) || ',' ||
       quote_literal(status) || ',' ||
       quote_literal(created_at) || ',' ||
       quote_literal(updated_at) ||
       ');' as insert_statement  
FROM users;

-- 4. Export all permissions
SELECT 'INSERT INTO permissions VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(name) || ',' ||
       quote_literal(description) || ',' ||
       quote_literal(created_at) ||
       ');' as insert_statement
FROM permissions;

-- 5. Export all roles
SELECT 'INSERT INTO roles VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(name) || ',' ||
       quote_literal(description) || ',' ||
       quote_literal(created_at) ||
       ');' as insert_statement
FROM roles;

-- 6. Export role_permissions
SELECT 'INSERT INTO role_permissions VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(role_id) || ',' ||
       quote_literal(permission_id) || ',' ||
       quote_literal(created_at) ||
       ');' as insert_statement
FROM role_permissions;

-- 7. Export user_roles  
SELECT 'INSERT INTO user_roles VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(user_id) || ',' ||
       quote_literal(role_id) || ',' ||
       quote_literal(created_at) ||
       ');' as insert_statement
FROM user_roles;

-- 8. Export societies
SELECT 'INSERT INTO societies VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(name) || ',' ||
       quote_literal(address) || ',' ||
       quote_literal(city) || ',' ||
       quote_literal(state) || ',' ||
       quote_literal(pincode) || ',' ||
       quote_literal(created_at) ||
       ');' as insert_statement
FROM societies;

-- 9. Export properties
SELECT 'INSERT INTO properties VALUES (' || 
       quote_literal(id) || ',' ||
       quote_literal(address) || ',' ||
       quote_literal(city) || ',' ||
       quote_literal(state) || ',' ||
       quote_literal(pincode) || ',' ||
       quote_literal(property_type) || ',' ||
       quote_literal(created_at) ||
       ');' as insert_statement
FROM properties;

-- Instructions:
-- 1. Run each SELECT statement in your production SQL runner
-- 2. Copy the results and save to files like:
--    - agreements_dump.sql
--    - customers_dump.sql  
--    - users_dump.sql
--    - etc.
-- 3. Combine all files into one complete dump