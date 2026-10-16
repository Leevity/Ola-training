import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  backupLocalData,
  verifyLocalBackup,
  restoreLocalData,
  auditRestoredData,
} from "../src/local-backup.ts";
import { acquireDataLock } from "../src/data-lock.ts";
import { openDatabase } from "../src/db.ts";
import { initialize } from "../src/bootstrap.ts";
test("本地备份拒绝运行中目录、恢复保留业务记录和原件、篡改文件拒绝恢复", async () => {
  const root = await mkdtemp(join(tmpdir(), "ola-backup-test-")),
    data = join(root, "data"),
    backup = join(root, "backup"),
    restored = join(root, "restored");
  try {
    await mkdir(data);
    await assert.rejects(auditRestoredData(data), /拒绝创建新库/);
    const release = await acquireDataLock(data, "test-server");
    await assert.rejects(acquireDataLock(data, "second-server"), /正在使用/);
    await release();
    await release();
    const db = await openDatabase(undefined, join(data, "postgres"));
    try {
      await initialize(db, {
        production: false,
        host: "127.0.0.1",
        port: 4190,
        origin: "http://127.0.0.1:4180",
        dataDir: data,
        adminEmail: "backup@test.local",
        adminPassword: "Backup-Test-Only!2026",
        sessionHours: 12,
        seedDemo: true,
      });
      const bytes = Buffer.from("资料与素材的真实字节");
      const digest = createHash("sha256").update(bytes).digest("hex");
      for (const folder of ["files", "assets"]) {
        await mkdir(join(data, folder, "fujian"), { recursive: true });
        await writeFile(join(data, folder, "fujian", "backup-fixture"), bytes);
      }
      await db.query(
        "INSERT INTO knowledge(id,tenant_id,name,category,size,mime,status,file_key,sha256) VALUES('backup-file','fujian','资料','测试',$1,'text/plain','pending','fujian/backup-fixture',$2)",
        [bytes.length, digest],
      );
      const course = (
        await db.query(
          "SELECT id,version FROM courses WHERE tenant_id='fujian' AND status='published' LIMIT 1",
        )
      ).rows[0];
      await db.query(
        "INSERT INTO course_assets(id,tenant_id,course_id,name,mime,ext,size,file_key,sha256) VALUES('backup-asset','fujian',$1,'素材','audio/wav','wav',$2,'fujian/backup-fixture',$3)",
        [course.id, bytes.length, digest],
      );
      await db.query(
        "INSERT INTO course_asset_refs(tenant_id,course_id,course_version,asset_id) VALUES('fujian',$1,$2,'backup-asset')",
        [course.id, course.version],
      );
    } finally {
      await db.close();
    }
    const busy = await acquireDataLock(data, "server");
    await assert.rejects(backupLocalData(data, backup), /正在使用/);
    await busy();
    await assert.rejects(
      backupLocalData(data, join(data, "nested-backup")),
      /不能互相包含/,
    );
    await assert.rejects(
      backupLocalData(data, join(data, "..nested-backup")),
      /不能互相包含/,
    );
    await writeFile(join(data, "ai-encryption-key"), "1".repeat(64), {
      mode: 0o600,
    });
    await backupLocalData(data, backup);
    assert.ok((await verifyLocalBackup(backup)).files.length > 10);
    await assert.rejects(backupLocalData(data, backup), /目标已存在/);
    await restoreLocalData(backup, restored);
    assert.equal(
      await readFile(join(restored, "ai-encryption-key"), "utf8"),
      "1".repeat(64),
    );
    const audit = await auditRestoredData(restored);
    assert.deepEqual(audit.migrations, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(audit.checkedFiles, 2);
    assert.equal(audit.counts.course_assets, 1);
    assert.ok(audit.counts.tasks > 0);
    assert.ok(audit.counts.assignments > 0);
    assert.equal(audit.counts.course_asset_refs, 1);
    await assert.rejects(restoreLocalData(backup, restored), /目标已存在/);
    await verifyLocalBackup(backup);
    await writeFile(
      join(backup, "files", "fujian", "backup-fixture"),
      "被改动",
    );
    await assert.rejects(verifyLocalBackup(backup), /SHA-256/);
    await assert.rejects(
      restoreLocalData(backup, join(root, "bad-restore")),
      /SHA-256/,
    );
    const manifestPath = join(backup, "ola-backup-manifest.json"),
      manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.files[0].path = "../escape";
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(verifyLocalBackup(backup), /无效或重复路径/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
