import {initialEquipment} from '../equipment/catalog';
import {toPrinter} from '../equipment/adapters';
import type {PrinterDetail} from './types';
export const printers:Record<string,PrinterDetail>=Object.fromEntries(initialEquipment.filter(p=>!p.removed).map(p=>[p.id,toPrinter(p)]));
export function getAllPrinterIds(){return Object.keys(printers);}
export function getPrinterById(id:string){return printers[id.toLowerCase()]??null;}
