import Database from "better-sqlite3";

const db = new Database("dev.db");
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'MachinePm%' ORDER BY name",
  )
  .all() as Array<{ name: string }>;
const historyCols = (
  db.prepare("PRAGMA table_info(MachinePmHistory)").all() as Array<{ name: string }>
).map((c) => c.name);
const stateCols = (
  db.prepare("PRAGMA table_info(MachinePmState)").all() as Array<{ name: string }>
).map((c) => c.name);

console.log("PM tables:", tables.map((t) => t.name).join(", "));
console.log(
  "Patch46 columns ok:",
  [
    "qualityScore",
    "checklistJson",
    "laborMinutes",
    "partsUsedJson",
  ].every((c) => historyCols.includes(c)) &&
    stateCols.includes("lastLaborMinutes") &&
    tables.some((t) => t.name === "MachinePmChecklistTemplate") &&
    tables.some((t) => t.name === "MachinePmDraft") &&
    tables.some((t) => t.name === "MachinePmAuditLog"),
);
db.close();
