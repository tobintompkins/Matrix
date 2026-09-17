import {initialEquipment} from '../equipment/catalog';
import {toTwin} from '../equipment/adapters';
import type {MachineStatus} from './types';
export const digitalTwinFleet=initialEquipment.filter(p=>!p.removed).map(toTwin);
export function getDigitalTwinMachine(id:string){return digitalTwinFleet.find(p=>p.identity.machineId.toLowerCase()===id.toLowerCase());}
export const digitalTwinModels=['GD9630','Valezus'];
export const digitalTwinOrganizations=['SFX / MPX'];
export const digitalTwinTechnicians=['Not assigned'];
export const MACHINE_STATUSES:MachineStatus[]=['UNKNOWN','ONLINE','OFFLINE','DEGRADED','SERVICE_REQUIRED','DOWN','INSTALLATION','RETIRED'];
