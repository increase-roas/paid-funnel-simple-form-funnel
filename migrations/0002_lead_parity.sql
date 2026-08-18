ALTER TABLE leads ADD COLUMN source TEXT NOT NULL DEFAULT 'form';
ALTER TABLE leads ADD COLUMN ghl_contact_id TEXT;
ALTER TABLE leads ADD COLUMN ghl_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE leads ADD COLUMN ghl_error TEXT;
ALTER TABLE leads ADD COLUMN vault_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE leads ADD COLUMN vault_error TEXT;
ALTER TABLE leads ADD COLUMN vault_synced_at TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_ghl_contact_id ON leads(ghl_contact_id);
