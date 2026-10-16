CREATE TABLE IF NOT EXISTS ai_provider_settings (
 tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
 base_url TEXT NOT NULL,
 model TEXT NOT NULL,
 encrypted_key TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
