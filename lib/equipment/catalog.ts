export type Equipment = { id: string; name: string; model: 'GD9630' | 'Valezus'; serialNumber: string; engine2SerialNumber: string; location: string; removed: boolean };
export const LOCATION = 'SFX/MPX — Portland, Maine';
export const initialEquipment: Equipment[] = [
  {
    "id": "yankee",
    "name": "Yankee",
    "model": "Valezus",
    "serialNumber": "36200236",
    "engine2SerialNumber": "36200237",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "dunkin-park",
    "name": "Dunkin Park",
    "model": "Valezus",
    "serialNumber": "34961300",
    "engine2SerialNumber": "34961409",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "fitzpatrick",
    "name": "Fitzpatrick",
    "model": "Valezus",
    "serialNumber": "36200245",
    "engine2SerialNumber": "36200249",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "metlife",
    "name": "MetLife",
    "model": "Valezus",
    "serialNumber": "36200049",
    "engine2SerialNumber": "3620067",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "td-garden",
    "name": "TD Garden",
    "model": "GD9630",
    "serialNumber": "3496243",
    "engine2SerialNumber": "",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "chase",
    "name": "Chase",
    "model": "GD9630",
    "serialNumber": "3496219",
    "engine2SerialNumber": "",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "ford",
    "name": "Ford",
    "model": "GD9630",
    "serialNumber": "34960870",
    "engine2SerialNumber": "",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "hawkins",
    "name": "Hawkins",
    "model": "GD9630",
    "serialNumber": "36052002",
    "engine2SerialNumber": "",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "camden",
    "name": "Camden",
    "model": "GD9630",
    "serialNumber": "34960871",
    "engine2SerialNumber": "",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "dreams",
    "name": "Dreams",
    "model": "GD9630",
    "serialNumber": "34961071",
    "engine2SerialNumber": "",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "busch",
    "name": "Busch",
    "model": "GD9630",
    "serialNumber": "34960936",
    "engine2SerialNumber": "",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  },
  {
    "id": "nationals",
    "name": "Nationals",
    "model": "GD9630",
    "serialNumber": "34960869",
    "engine2SerialNumber": "",
    "location": "SFX/MPX — Portland, Maine",
    "removed": false
  }
];
export type Catalog = { revision: number; equipment: Equipment[]; canEdit?: boolean };
export function validateEquipment(input: unknown): Equipment {
 if (!input || typeof input !== 'object') throw new Error('Printer details are required.');
 const p = input as Record<string, unknown>;
 const text = (key: string) => typeof p[key] === 'string' ? (p[key] as string).trim() : '';
 const id=text('id'), name=text('name'), serialNumber=text('serialNumber'), engine2SerialNumber=text('engine2SerialNumber');
 if (!/^[a-z0-9-]{1,80}$/.test(id)) throw new Error('Invalid printer ID.');
 if (!name || name.length>100) throw new Error('Enter a printer name of up to 100 characters.');
 if (!/^\d{1,30}$/.test(serialNumber)) throw new Error('Enter the serial number using digits.');
 if (p.model!=='GD9630' && p.model!=='Valezus') throw new Error('Select GD9630 or VALEZUS.');
 if (p.model==='Valezus' && (!/^\d{1,30}$/.test(engine2SerialNumber) || serialNumber===engine2SerialNumber)) throw new Error('Enter two different engine serial numbers.');
 if (typeof p.removed!=='boolean') throw new Error('Invalid removal status.');
 return {id,name,model:p.model,serialNumber,engine2SerialNumber:p.model==='Valezus'?engine2SerialNumber:'',location:LOCATION,removed:p.removed};
}
export function validateCatalog(input: unknown): Equipment[] {
 if (!Array.isArray(input) || input.length>500) throw new Error('Invalid printer list.');
 const list=input.map(validateEquipment), ids=new Set<string>(), serials=new Set<string>(), names=new Set<string>();
 for (const p of list) {
  if (ids.has(p.id)) throw new Error('Duplicate printer ID.'); ids.add(p.id);
  if (p.removed) continue;
  if(names.has(p.name.toLowerCase())) throw new Error('A printer with that name already exists.'); names.add(p.name.toLowerCase());
  for(const sn of [p.serialNumber,p.engine2SerialNumber].filter(Boolean)) { if(serials.has(sn)) throw new Error('A printer with that serial number already exists.'); serials.add(sn); }
 }
 return list;
}
