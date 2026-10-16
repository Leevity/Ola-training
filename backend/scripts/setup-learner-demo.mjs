// Only provisions the built-in development fixture, through the running local API.
import { readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL)
  throw new Error("Development demo only");
const output = new URL("../data/learner-demo-credentials.txt", import.meta.url);
try {
  await access(output);
  console.log(
    "Demo credentials already exist in backend/data/learner-demo-credentials.txt",
  );
  process.exit(0);
} catch {}
const initial = await readFile(
  new URL("../data/bootstrap-credentials.txt", import.meta.url),
  "utf8",
);
const email = initial.match(/邮箱：(.+)/)?.[1].trim(),
  password = initial.match(/密码：(.+)/)?.[1].trim();
if (!email || !password)
  throw new Error("Missing development bootstrap credentials");
const base = "http://127.0.0.1:4180/api";
const health = await fetch(base + "/health");
if (!health.ok || (await health.json()).database !== "pglite")
  throw new Error("Demo setup requires the local PGlite development service");
const login = await fetch(base + "/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error("Admin login failed");
const cookie = login.headers.get("set-cookie").split(";")[0],
  csrf = (await login.json()).csrf;
async function call(path, method = "GET", body) {
  const r = await fetch(base + path, {
    method,
    headers: {
      cookie,
      "x-csrf-token": csrf,
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`API ${path}: ${r.status}`);
  return r.json();
}
await call("/auth/switch-tenant", "POST", { tenantId: "fujian" });
const snapshot = await call("/bootstrap");
const member = snapshot.db.members.find(
  (m) => m.name === "林雨欣" && m.employeeNo === "EMP1001",
);
if (!member || member.email)
  throw new Error(
    "Built-in learner is absent or already has an account; no account changed",
  );
const learnerEmail = "learner@ola.local",
  learnerPassword = randomBytes(20).toString("base64url");
await call(`/tenants/fujian/members/${member.id}/account`, "POST", {
  email: learnerEmail,
  password: learnerPassword,
});
await writeFile(
  output,
  `本地开发学员（林雨欣）\n邮箱：${learnerEmail}\n密码：${learnerPassword}\n`,
  { mode: 0o600 },
);
await call("/auth/logout", "POST", {});
console.log(
  "Local learner provisioned. Credentials: backend/data/learner-demo-credentials.txt",
);
