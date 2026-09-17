import 'server-only';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { initialEquipment, validateCatalog, type Catalog } from './catalog';
function open() {
 const dir=process.env.MATRIX_EQUIPMENT_DIR || join(process.cwd(),'data'); mkdirSync(dir,{recursive:true});
 const db=new Database(join(dir,'equipment.sqlite')); db.pragma('busy_timeout = 5000'); db.pragma('journal_mode = WAL');
 db.exec('CREATE TABLE IF NOT EXISTS equipment_catalog (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL)');
 db.prepare('INSERT OR IGNORE INTO equipment_catalog VALUES (1,0,?)').run(JSON.stringify(initialEquipment)); return db;
}
export function readCatalog(): Catalog { const db=open(); try { const row=db.prepare('SELECT revision,payload FROM equipment_catalog WHERE id=1').get() as {revision:number;payload:string}; return {revision:row.revision,equipment:validateCatalog(JSON.parse(row.payload))}; } finally { db.close(); } }
export function saveCatalog(revision: number, input: unknown): Catalog {
 const equipment=validateCatalog(input), db=open();
 try { return db.transaction(()=>{ const result=db.prepare('UPDATE equipment_catalog SET revision=revision+1,payload=? WHERE id=1 AND revision=?').run(JSON.stringify(equipment),revision);
 if(!result.changes) throw new Error('CONFLICT'); return {revision:revision+1,equipment}; })(); } finally { db.close(); }
}
