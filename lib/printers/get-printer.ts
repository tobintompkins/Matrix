import {readCatalog} from '../equipment/store';
import {toPrinter} from '../equipment/adapters';
export async function getPrinter(id:string){const p=readCatalog().equipment.find(p=>!p.removed&&p.id===id.toLowerCase());return p?toPrinter(p):null;}
