import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../server/db.mjs";
import { createUser } from "../server/auth.mjs";
import { createApp } from "../server/app.mjs";
if (!process.env.E2E_PASSWORD) throw Error("E2E_PASSWORD required");
const dir = mkdtempSync(join(tmpdir(), "mahzoof-e2e-"));
const db = openDatabase(join(dir, "test.sqlite"));
createUser(db, "e2e-admin", process.env.E2E_PASSWORD);
createUser(db, "e2e-secretary", process.env.E2E_PASSWORD, "secretary");
createUser(db, "e2e-accountant", process.env.E2E_PASSWORD, "accountant");
const server = createApp(db, { origin: "http://localhost:4310" }).listen(
  4310,
  "127.0.0.1",
);
function stop() {
  server.close(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    process.exit();
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
