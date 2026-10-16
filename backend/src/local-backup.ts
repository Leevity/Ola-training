import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readdir,
  lstat,
  readFile,
  writeFile,
  copyFile,
  rename,
  realpath,
} from "node:fs/promises";
import { resolve, relative, join, isAbsolute, dirname, sep } from "node:path";
import { acquireDataLock, dataLockName } from "./data-lock.ts";
import { openDatabase } from "./db.ts";
const manifestName = "ola-backup-manifest.json";
type Entry = { path: string; size: number; sha256: string };
type Manifest = {
  format: 1;
  database: "pglite";
  createdAt: string;
  directories: string[];
  files: Entry[];
};
async function hash(path: string) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
async function exists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
function inside(parent: string, child: string) {
  const rel = relative(parent, child);
  return (
    !rel || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  );
}
async function destinationPath(path: string) {
  const absolute = resolve(path);
  if (await exists(absolute))
    throw new Error("目标已存在；请使用新的空路径，不会覆盖已有数据。");
  await mkdir(dirname(absolute), { recursive: true });
  return join(
    await realpath(dirname(absolute)),
    absolute.split(/[\\/]/).pop()!,
  );
}
async function inventory(root: string, skipRoot = new Set<string>()) {
  const files: Entry[] = [],
    directories: string[] = [];
  async function walk(folder: string) {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, item.name),
        rel = relative(root, path).replaceAll("\\", "/");
      if (folder === root && skipRoot.has(item.name)) continue;
      const info = await lstat(path);
      if (info.isSymbolicLink())
        throw new Error("数据目录包含符号链接，拒绝备份或恢复。");
      if (info.isDirectory()) {
        directories.push(rel);
        await walk(path);
      } else if (info.isFile())
        files.push({ path: rel, size: info.size, sha256: await hash(path) });
      else throw new Error("数据目录包含不支持的特殊文件。");
    }
  }
  await walk(root);
  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    directories: directories.sort(),
  };
}
async function copyEntries(
  source: string,
  target: string,
  files: Entry[],
  directories: string[],
) {
  for (const directory of directories)
    await mkdir(join(target, directory), { recursive: true });
  for (const file of files) {
    const destination = join(target, file.path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(source, file.path), destination);
  }
}
function parseManifest(raw: string): Manifest {
  const manifest = JSON.parse(raw);
  if (
    manifest.format !== 1 ||
    manifest.database !== "pglite" ||
    !Array.isArray(manifest.directories) ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length
  )
    throw new Error("备份清单格式不支持");
  const paths = new Set();
  for (const path of manifest.directories) {
    if (
      typeof path !== "string" ||
      path.includes("\\") ||
      path.includes(":") ||
      isAbsolute(path) ||
      path
        .split("/")
        .some((part: string) => !part || part === "." || part === "..") ||
      paths.has(path.toLowerCase())
    )
      throw new Error("备份目录清单无效");
    paths.add(path.toLowerCase());
  }
  for (const file of manifest.files) {
    if (
      typeof file.path !== "string" ||
      file.path.includes("\\") ||
      file.path
        .split("/")
        .some((part: string) => !part || part === "." || part === "..") ||
      isAbsolute(file.path) ||
      file.path.includes(":") ||
      [manifestName, dataLockName].includes(file.path) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      paths.has(file.path.toLowerCase())
    )
      throw new Error("备份清单包含无效或重复路径");
    paths.add(file.path.toLowerCase());
  }
  if (!manifest.files.some((file: Entry) => file.path.startsWith("postgres/")))
    throw new Error("备份缺少PGlite数据库");
  return manifest;
}
export async function verifyLocalBackup(path: string) {
  const root = await realpath(path);
  if ((await lstat(join(root, manifestName))).isSymbolicLink())
    throw new Error("备份清单不能是符号链接");
  const manifest = parseManifest(
    await readFile(join(root, manifestName), "utf8"),
  );
  const actual = await inventory(root, new Set([manifestName]));
  if (
    JSON.stringify(actual.files) !== JSON.stringify(manifest.files) ||
    JSON.stringify(actual.directories) !== JSON.stringify(manifest.directories)
  )
    throw new Error("备份文件缺失、多出或SHA-256不一致，拒绝恢复。");
  return manifest;
}
export async function backupLocalData(sourcePath: string, targetPath: string) {
  const source = await realpath(sourcePath),
    target = await destinationPath(targetPath);
  if (inside(source, target) || inside(target, source))
    throw new Error("备份源与目标不能互相包含");
  if (!(await exists(join(source, "postgres", "PG_VERSION"))))
    throw new Error("源目录不是本地PGlite数据目录");
  const release = await acquireDataLock(source, "backup");
  const staging = `${target}.partial`;
  try {
    await mkdir(staging, { recursive: false, mode: 0o700 });
    const { files, directories } = await inventory(
      source,
      new Set([dataLockName]),
    );
    await copyEntries(source, staging, files, directories);
    const manifest: Manifest = {
      format: 1,
      database: "pglite",
      createdAt: new Date().toISOString(),
      files,
      directories,
    };
    await writeFile(
      join(staging, manifestName),
      JSON.stringify(manifest, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    await verifyLocalBackup(staging);
    if (await exists(target)) throw new Error("目标在备份期间被创建，拒绝覆盖");
    await rename(staging, target);
    return {
      directory: target,
      files: files.length,
      bytes: files.reduce((sum, file) => sum + file.size, 0),
    };
  } finally {
    await release();
  }
}
export async function restoreLocalData(sourcePath: string, targetPath: string) {
  const source = await realpath(sourcePath),
    target = await destinationPath(targetPath);
  if (inside(source, target) || inside(target, source))
    throw new Error("恢复源与目标不能互相包含");
  const manifest = await verifyLocalBackup(source),
    staging = `${target}.partial`;
  await mkdir(staging, { recursive: false, mode: 0o700 });
  await copyEntries(source, staging, manifest.files, manifest.directories);
  const actual = await inventory(staging);
  if (
    JSON.stringify(actual.files) !== JSON.stringify(manifest.files) ||
    JSON.stringify(actual.directories) !== JSON.stringify(manifest.directories)
  )
    throw new Error("恢复文件校验失败");
  if (await exists(target)) throw new Error("恢复目标已被创建，拒绝覆盖");
  await rename(staging, target);
  return { directory: target, files: actual.files.length };
}
/** Open only an isolated restored copy: PGlite startup itself may update its files. */
export async function auditRestoredData(directory: string) {
  const root = await realpath(directory);
  if (!(await exists(join(root, "postgres", "PG_VERSION"))))
    throw new Error("恢复目录缺少PGlite数据库，拒绝创建新库");
  const release = await acquireDataLock(root, "restore-audit");
  let db: Awaited<ReturnType<typeof openDatabase>> | undefined;
  try {
    db = await openDatabase(undefined, join(root, "postgres"));
    const tables = [
      "tenants",
      "members",
      "courses",
      "course_versions",
      "tasks",
      "task_items",
      "assignments",
      "learning_progress",
      "classroom_runtime",
      "exam_attempts",
      "training_sessions",
      "knowledge",
      "course_assets",
      "course_asset_refs",
    ];
    const counts: Record<string, number> = {};
    for (const table of tables)
      counts[table] = Number(
        (await db.query(`SELECT count(*) AS count FROM ${table}`)).rows[0]
          .count,
      );
    let checkedFiles = 0;
    for (const [table, folder] of [
      ["knowledge", "files"],
      ["course_assets", "assets"],
    ]) {
      const rows = (
        await db.query(
          `SELECT file_key,sha256 FROM ${table} WHERE file_key IS NOT NULL`,
        )
      ).rows;
      for (const row of rows) {
        if (
          typeof row.file_key !== "string" ||
          row.file_key.includes("\\") ||
          row.file_key.includes(":") ||
          row.file_key
            .split("/")
            .some((part: string) => !part || part === "." || part === "..")
        )
          throw new Error("数据库文件引用不安全");
        const file = join(root, folder, row.file_key);
        if ((await hash(file)) !== row.sha256)
          throw new Error(`${table}原件缺失或校验不一致`);
        checkedFiles++;
      }
    }
    const migrations = (
      await db.query("SELECT version FROM schema_migrations ORDER BY version")
    ).rows.map((row) => Number(row.version));
    return { counts, checkedFiles, migrations };
  } finally {
    try {
      await db?.close();
    } finally {
      await release();
    }
  }
}
