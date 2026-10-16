import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export const dataLockName = ".ola-data.lock";
/** A fail-closed lock. Never infer that a PID is stale and remove another owner's lock. */
export async function acquireDataLock(directory: string, purpose: string) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, dataLockName),
    token = randomUUID();
  let handle;
  try {
    handle = await open(path, "wx", 0o600);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(
        "数据目录正在使用或存在未清理的锁；停止服务并核对锁内PID后再操作。",
      );
    throw e;
  }
  try {
    await handle.writeFile(
      JSON.stringify({
        pid: process.pid,
        purpose,
        token,
        createdAt: new Date().toISOString(),
      }),
    );
  } catch (e) {
    await handle.close();
    await unlink(path);
    throw e;
  }
  await handle.close();
  let released = false;
  return async () => {
    if (released) return;
    const owner = JSON.parse(await readFile(path, "utf8"));
    if (owner.token !== token)
      throw new Error("数据目录锁所有者已改变，拒绝清理");
    await unlink(path);
    released = true;
  };
}
