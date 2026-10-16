CREATE TABLE IF NOT EXISTS classroom_runtime (
 tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, course_id TEXT NOT NULL, course_version INTEGER NOT NULL, scene_id TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,member_id,course_id,course_version,scene_id),
 FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id),
 FOREIGN KEY(tenant_id,course_id,course_version) REFERENCES course_versions(tenant_id,course_id,version)
);
CREATE TABLE IF NOT EXISTS classroom_runtime_events (
 tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, course_id TEXT NOT NULL, course_version INTEGER NOT NULL, scene_id TEXT NOT NULL,
 event_id TEXT NOT NULL, input_hash TEXT NOT NULL, result JSONB NOT NULL,
 PRIMARY KEY(tenant_id,member_id,course_id,course_version,scene_id,event_id),
 FOREIGN KEY(tenant_id,member_id,course_id,course_version,scene_id) REFERENCES classroom_runtime(tenant_id,member_id,course_id,course_version,scene_id)
);
INSERT INTO schema_migrations(version) VALUES(5) ON CONFLICT DO NOTHING;
