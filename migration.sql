ALTER TABLE agreements ADD COLUMN IF NOT EXISTS owner_documents JSONB DEFAULT '{}';
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS tenant_documents JSONB DEFAULT '{}';
