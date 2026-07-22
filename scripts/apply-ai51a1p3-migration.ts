import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = path.resolve(process.cwd(), "dev.db");
const sqlPath = path.resolve(
  process.cwd(),
  "prisma/migrations/20260714230000_ai_assistant_51a1p3/migration.sql",
);

const sql = fs.readFileSync(sqlPath, "utf8");
const db = new Database(dbPath);

const statements = sql
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter((s) => s.length > 0);

for (const statement of statements) {
  try {
    db.exec(statement);
    console.log("OK:", statement.slice(0, 72).replace(/\s+/g, " "));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate column|already exists/i.test(msg)) {
      console.log("SKIP:", msg);
      continue;
    }
    console.error("FAIL:", msg);
    console.error(statement);
    process.exit(1);
  }
}

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ai_assistant%' ORDER BY name",
  )
  .all();
console.log("Tables:", tables);
db.close();
console.log("Patch 51A.1 Part 3 migration applied to", dbPath);
