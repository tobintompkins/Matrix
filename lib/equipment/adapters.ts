import type {Equipment} from './catalog';
import type {DigitalTwinMachine} from '../digital-twin/types';
import type {PrinterDetail} from '../printers/types';
export function toTwin(p:Equipment): DigitalTwinMachine { return {
 identity:{machineId:p.id,assetTag:p.id,serialNumber:p.serialNumber,printerModel:p.model,nickname:p.name,manufacturer:'RISO',installationDate:'Not recorded'},
 location:{customerName:'SFX/MPX',siteName:p.location,building:'Not recorded',department:'Not recorded',floor:'Not recorded',physicalLocation:p.name,shipToAddress:'Not recorded',primaryContact:'Not assigned',contactPhone:'Not recorded',contactEmail:'Not recorded',organization:'SFX / MPX'},
 assignment:{assignedTechnician:'Not assigned',assignedRegion:'Portland, Maine',assignedOrganization:'SFX / MPX',assignedWarehouse:'Not assigned',assignedServiceTeam:'Not assigned'},
 operational:{status:'UNKNOWN',currentMeterCount:NaN,monthlyVolume:NaN,lastReportedActivity:'Not recorded',downtimeStatus:'Not verified'},
 network:{networkStatus:'UNKNOWN',rraStatus:'Not verified',ipAddress:'Not recorded',hostname:'Not recorded',firmwareVersion:'Not recorded',controllerVersion:'Not recorded'},
 service:{lastServiceDate:'Not recorded',lastPmDate:'Not recorded',nextPmMeterTarget:NaN,currentPmMeterRemaining:NaN,openServiceCalls:0,recentErrorCodes:[],downtimeStatus:'Not verified'},
 configuration:{installedAccessories:p.model==='Valezus'?['Double tray feeders','Two stackers']:[],finishingOptions:[],paperFeedConfiguration:p.model==='Valezus'?'Double tray feeders':'Not recorded',outputConfiguration:p.model==='Valezus'?'Two stackers':'Not recorded',controllerType:'Not recorded',specialCustomerConfiguration:p.model==='Valezus'?'Engine 1: '+p.serialNumber+'; Engine 2: '+p.engine2SerialNumber:'Not recorded',supportedPaperSizes:[]},
 parts:{frequentlyUsedParts:[],currentlyInstalled:[],recentPartsReplaced:[],openPartsOrders:0,emergencyPartsNeeds:[],diagramShortcut:'/guided-diagram-ordering'},alerts:[],health:{score:NaN,band:'UNKNOWN',factors:['Live equipment condition has not been verified.']},notes:[],attachments:[],serviceHistory:[]
 }; }
export function toPrinter(p:Equipment): PrinterDetail {return {id:p.id,model:p.model,serialNumber:p.serialNumber,assetNumber:p.name,customer:'SFX/MPX',location:p.location,status:'Not verified',meters:{totalImpressions:NaN,color:NaN,black:NaN,lastMeterRead:'Not recorded'},pm:{lastPM:'Not recorded',nextPMDue:'Not recorded',pmKitInstalled:'Not recorded'},copyCount:{currentCopyCount:null,previousCopyCount:null,monthlyVolume:null,lastPMDate:null,lastCleaningDate:null,lastJointUnitDate:null,lastDTFPMDate:null,nextPMDue:null,nextCleaningDue:null,nextJointUnitDue:null,nextDTFDue:null},components:[],serviceHistory:[],openTickets:[]};}
