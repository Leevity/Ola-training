CREATE TABLE IF NOT EXISTS course_assets (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, course_id TEXT NOT NULL,
 name TEXT NOT NULL, mime TEXT NOT NULL, ext TEXT NOT NULL, size INTEGER NOT NULL,
 file_key TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS course_asset_refs (
 tenant_id TEXT NOT NULL, course_id TEXT NOT NULL, course_version INTEGER NOT NULL, asset_id TEXT NOT NULL,
 PRIMARY KEY(tenant_id,course_id,course_version,asset_id),
 FOREIGN KEY(tenant_id,course_id,course_version) REFERENCES course_versions(tenant_id,course_id,version),
 FOREIGN KEY(tenant_id,asset_id) REFERENCES course_assets(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS course_asset_refs_lookup ON course_asset_refs(tenant_id,asset_id);
INSERT INTO schema_migrations(version) VALUES(8) ON CONFLICT DO NOTHING;
