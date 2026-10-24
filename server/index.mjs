import { openDatabase } from "./db.mjs";
import { createApp } from "./app.mjs";
const db = openDatabase();
const server = createApp(db).listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () => console.log("Mahzoof: http://localhost:" + (process.env.PORT || 3000)),
);
process.on("SIGTERM", () => server.close(() => db.close()));
