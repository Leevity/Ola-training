CREATE TABLE IF NOT EXISTS learner_favorites (
 tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, course_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,member_id,course_id), FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id), FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS course_reviews (
 tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, course_id TEXT NOT NULL, version INTEGER NOT NULL,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,member_id,course_id,version), FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id), FOREIGN KEY(tenant_id,course_id,version) REFERENCES course_versions(tenant_id,course_id,version)
);
CREATE TABLE IF NOT EXISTS assistant_sessions (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, app TEXT NOT NULL, title TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS assistant_messages (
 tenant_id TEXT NOT NULL, session_id TEXT NOT NULL, id TEXT NOT NULL, text TEXT NOT NULL, result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,session_id,id), FOREIGN KEY(tenant_id,session_id) REFERENCES assistant_sessions(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS notification_reads (
 tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, notification_id TEXT NOT NULL, read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,member_id,notification_id), FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id)
);
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
