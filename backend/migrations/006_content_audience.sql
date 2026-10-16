ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS audience JSONB NOT NULL DEFAULT '{"mode":"enterprise","departments":[],"memberIds":[]}';
INSERT INTO schema_migrations(version) VALUES(6) ON CONFLICT DO NOTHING;
