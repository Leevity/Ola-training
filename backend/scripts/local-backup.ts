import {
  backupLocalData,
  verifyLocalBackup,
  restoreLocalData,
  auditRestoredData,
} from "../src/local-backup.ts";
const [command, source, target, ...extra] = process.argv.slice(2);
try {
  if (extra.length || !source)
    throw new Error(
      "用法：local-backup backup <停止服务的数据目录> <新备份目录> | verify <备份目录> | restore <备份目录> <新数据目录> | audit <隔离恢复目录>",
    );
  if (command === "backup" && target)
    console.log(JSON.stringify(await backupLocalData(source, target), null, 2));
  else if (command === "restore" && target)
    console.log(
      JSON.stringify(await restoreLocalData(source, target), null, 2),
    );
  else if (command === "verify" && !target) {
    const result = await verifyLocalBackup(source);
    console.log(
      JSON.stringify({
        valid: true,
        createdAt: result.createdAt,
        files: result.files.length,
      }),
    );
  } else if (command === "audit" && !target)
    console.log(JSON.stringify(await auditRestoredData(source), null, 2));
  else throw new Error("命令或参数不正确");
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
