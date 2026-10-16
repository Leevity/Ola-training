ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS parse_error TEXT;
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS parse_token TEXT;
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS parse_started_at TIMESTAMPTZ;
ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS parse_units JSONB NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS authoring_jobs (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 course_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 request_key TEXT NOT NULL,
 input_hash TEXT NOT NULL,
 input JSONB NOT NULL,
 state TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 checkpoint JSONB NOT NULL DEFAULT '{}',
 lease_token TEXT,
 lease_until TIMESTAMPTZ,
 error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,request_key),
 FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS authoring_active_course ON authoring_jobs(tenant_id,course_id) WHERE state IN ('queued_outline','running_outline','awaiting_outline','queued_scenes','running_scenes');
CREATE TABLE IF NOT EXISTS authoring_events (
 id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, job_id TEXT NOT NULL, state TEXT NOT NULL, detail TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,job_id) REFERENCES authoring_jobs(tenant_id,id)
);
INSERT INTO schema_migrations(version) VALUES(4) ON CONFLICT DO NOTHING;
