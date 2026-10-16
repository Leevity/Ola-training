CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tenants (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 departments JSONB NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS accounts (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 platform_admin BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS members (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), account_id TEXT REFERENCES accounts(id),
 name TEXT NOT NULL, employee_no TEXT NOT NULL, department TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('学员','内容作者','部门管理员','企业管理员')), active BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,employee_no), UNIQUE(tenant_id,account_id)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), tenant_id TEXT NOT NULL REFERENCES tenants(id),
 csrf_token TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS courses (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), title TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('learn','train','exam')), category TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('draft','published','archived')), version INTEGER NOT NULL CHECK(version>0),
 data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS courses_tenant_status ON courses(tenant_id,status);
CREATE TABLE IF NOT EXISTS course_versions (
 tenant_id TEXT NOT NULL, course_id TEXT NOT NULL, version INTEGER NOT NULL,
 content JSONB NOT NULL, published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,course_id,version), FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS knowledge (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, category TEXT NOT NULL,
 size BIGINT NOT NULL CHECK(size>=0), mime TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('ready','pending','archived','failed')),
 text_content TEXT, file_key TEXT, sha256 TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS course_knowledge (
 tenant_id TEXT NOT NULL, course_id TEXT NOT NULL, knowledge_id TEXT NOT NULL,
 PRIMARY KEY(tenant_id,course_id,knowledge_id),
 FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id),
 FOREIGN KEY(tenant_id,knowledge_id) REFERENCES knowledge(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 start_date DATE NOT NULL, due_date DATE NOT NULL, sequential BOOLEAN NOT NULL DEFAULT TRUE,
 status TEXT NOT NULL CHECK(status IN ('draft','published','archived')), assigned_at TIMESTAMPTZ,
 CHECK(start_date<=due_date), UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS task_items (
 tenant_id TEXT NOT NULL, task_id TEXT NOT NULL, course_id TEXT NOT NULL, course_version INTEGER, position INTEGER NOT NULL,
 PRIMARY KEY(tenant_id,task_id,course_id), UNIQUE(tenant_id,task_id,position),
 FOREIGN KEY(tenant_id,task_id) REFERENCES tasks(tenant_id,id),
 FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id),
 FOREIGN KEY(tenant_id,course_id,course_version) REFERENCES course_versions(tenant_id,course_id,version)
);
CREATE TABLE IF NOT EXISTS assignments (
 tenant_id TEXT NOT NULL, task_id TEXT NOT NULL, member_id TEXT NOT NULL, completed_at TIMESTAMPTZ,
 PRIMARY KEY(tenant_id,task_id,member_id),
 FOREIGN KEY(tenant_id,task_id) REFERENCES tasks(tenant_id,id),
 FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS learning_progress (
 tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, course_id TEXT NOT NULL, course_version INTEGER NOT NULL,
 lesson_id TEXT NOT NULL, event_id TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,member_id,course_id,course_version,lesson_id), UNIQUE(tenant_id,member_id,event_id),
 FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id),
 FOREIGN KEY(tenant_id,course_id,course_version) REFERENCES course_versions(tenant_id,course_id,version)
);
CREATE TABLE IF NOT EXISTS questions (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, course_id TEXT NOT NULL, data JSONB NOT NULL,
 FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id), UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS exam_attempts (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, course_id TEXT NOT NULL, course_version INTEGER NOT NULL,
 paper JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'active',
 score INTEGER, passed BOOLEAN, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, submitted_at TIMESTAMPTZ,
 FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id),
 FOREIGN KEY(tenant_id,course_id,course_version) REFERENCES course_versions(tenant_id,course_id,version), UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS training_sessions (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, course_id TEXT NOT NULL, course_version INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'active', evaluation JSONB, score INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,member_id) REFERENCES members(tenant_id,id),
 FOREIGN KEY(tenant_id,course_id,course_version) REFERENCES course_versions(tenant_id,course_id,version), UNIQUE(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS training_messages (
 tenant_id TEXT NOT NULL, session_id TEXT NOT NULL, id TEXT NOT NULL, text TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,session_id,id),
 FOREIGN KEY(tenant_id,session_id) REFERENCES training_sessions(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS generation_jobs (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, course_id TEXT NOT NULL, upstream_id TEXT, stage_id TEXT, request_key TEXT, requirement TEXT,
 state TEXT NOT NULL, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,course_id) REFERENCES courses(tenant_id,id), UNIQUE(tenant_id,id), UNIQUE(tenant_id,request_key)
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), actor_id TEXT NOT NULL,
 action TEXT NOT NULL, target TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_tenant_date ON audit_logs(tenant_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS exam_single_active ON exam_attempts(tenant_id,member_id,course_id,course_version) WHERE status='active';
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
