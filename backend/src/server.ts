import { readConfig } from "./config.ts";
import { openDatabase } from "./db.ts";
import { initialize } from "./bootstrap.ts";
import { buildApp } from "./app.ts";
import { acquireDataLock } from "./data-lock.ts";
const config = readConfig();
// PostgreSQL supports multiple API instances; the local PGlite directory does not.
const release = config.databaseUrl
  ? async () => {}
  : await acquireDataLock(config.dataDir, "server");
let db: Awaited<ReturnType<typeof openDatabase>> | undefined,
  app: Awaited<ReturnType<typeof buildApp>> | undefined;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await app?.close();
  } finally {
    try {
      await db?.close();
    } finally {
      await release();
    }
  }
}
try {
  db = await openDatabase(config.databaseUrl, `${config.dataDir}/postgres`);
  await initialize(db, config);
  app = await buildApp(db, config, true);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(
      signal,
      () =>
        void stop().catch((error) => {
          console.error(error);
          process.exitCode = 1;
        }),
    );
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  await stop();
  throw error;
}
