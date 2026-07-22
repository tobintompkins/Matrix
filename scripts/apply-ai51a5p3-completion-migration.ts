import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = path.resolve(process.cwd(), "dev.db");
const sqlPath = path.resolve(
  process.cwd(),
  "prisma/migrations/20260717140000_executive_completion_51a5_p3/migration.sql",
);

const db = new Database(dbPath);

function execStatements(sql: string) {
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
      process.exit(1);
    }
  }
}

execStatements(fs.readFileSync(sqlPath, "utf8"));

const alterColumns: Array<[string, string]> = [
  ["timezone", "TEXT NOT NULL DEFAULT 'America/New_York'"],
  ["runHour", "INTEGER NOT NULL DEFAULT 6"],
  ["jobType", "TEXT NOT NULL DEFAULT 'REPORT'"],
  ["filtersJson", "TEXT NOT NULL DEFAULT '{}'"],
  ["lastResult", "TEXT"],
  ["failureMessage", "TEXT"],
];

for (const [col, def] of alterColumns) {
  try {
    db.exec(
      `ALTER TABLE "executive_report_schedules" ADD COLUMN "${col}" ${def}`,
    );
    console.log("OK: ADD COLUMN", col);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate column/i.test(msg)) console.log("SKIP:", col);
    else {
      console.error("FAIL ALTER", col, msg);
      process.exit(1);
    }
  }
}

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'executive_%' ORDER BY name",
  )
  .all();
console.log("Tables:", tables);
db.close();
console.log("Executive completion migration applied to", dbPath);
