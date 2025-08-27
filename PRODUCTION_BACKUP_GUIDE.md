# 🚨 COMPLETE PRODUCTION DATABASE BACKUP GUIDE

## 🎯 Goal: Backup EVERYTHING from Production
- All 86+ agreements
- All customer records
- All user accounts
- All uploaded files
- All system configuration
- All RBAC settings

## 🔄 Method 1: Replit Database Tool (EASIEST)

### Step 1: Access Production
1. Go to your **production Repl** (not development)
2. Click on **"Database"** tab in left sidebar
3. You should see your production database tables

### Step 2: Export Using Drizzle Studio
1. **Open Drizzle Studio** (should be available in Database tab)
2. **Select all tables** one by one
3. **Export each table** to CSV/SQL format
4. **Download files** to your computer

### Step 3: Save with Timestamps
- Name files: `production_agreements_2025-08-27.sql`
- Name files: `production_customers_2025-08-27.sql`
- Name files: `production_users_2025-08-27.sql`
- etc.

## 🔄 Method 2: SQL Runner (COMPLETE)

### Step 1: Access SQL Runner
1. In your production Database tab
2. Look for **"SQL Runner"** or **"Query"** option
3. Run these commands one by one:

```sql
-- Export all agreements
COPY (SELECT * FROM agreements) TO '/tmp/agreements_backup.csv' WITH CSV HEADER;

-- Export all customers  
COPY (SELECT * FROM customers) TO '/tmp/customers_backup.csv' WITH CSV HEADER;

-- Export all users
COPY (SELECT * FROM users) TO '/tmp/users_backup.csv' WITH CSV HEADER;

-- Export all permissions
COPY (SELECT * FROM permissions) TO '/tmp/permissions_backup.csv' WITH CSV HEADER;

-- Export all roles
COPY (SELECT * FROM roles) TO '/tmp/roles_backup.csv' WITH CSV HEADER;

-- Export role permissions
COPY (SELECT * FROM role_permissions) TO '/tmp/role_permissions_backup.csv' WITH CSV HEADER;

-- Export user roles
COPY (SELECT * FROM user_roles) TO '/tmp/user_roles_backup.csv' WITH CSV HEADER;
```

### Step 2: Download Files
- Look for download option to get the CSV files
- Save all files to your computer

## 🔄 Method 3: Full Database Dump (BEST)

### Step 1: Get Connection Details
1. In production Database tab
2. Look for **"Connection String"** or **"Database URL"**
3. Copy the connection details

### Step 2: Use PostgreSQL Tools
If you have `pg_dump` available:
```bash
pg_dump "your_production_database_url" > production_full_backup_2025-08-27.sql
```

## 📁 Don't Forget File Uploads!

### Backup Uploaded Files
1. **Go to your production file storage**
2. **Download entire `/uploads` folder**
3. **Save as**: `production_uploads_2025-08-27.zip`

## ✅ Verification Checklist

After backup, verify you have:
- [ ] All agreement records (should be 86+)
- [ ] All customer data
- [ ] All user accounts and roles
- [ ] All RBAC permissions and mappings
- [ ] All uploaded documents/files
- [ ] Database schema structure

## 🆘 If Backup Fails

### Replit Restore Tool
- Replit has built-in **"Restore tool"**
- Can revert database to specific point in time
- Available as safety net if something goes wrong

### Emergency Contact
- Keep multiple backup copies
- Store in different locations (local + cloud)
- Test restore process before making changes

---

**⚠️ CRITICAL**: Test your backup by trying to restore it in a test environment before proceeding with any production changes!