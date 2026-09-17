import {initialEquipment} from '../equipment/catalog';
import type {PrinterMaintenanceProfile,CopyCountHistory,MaintenanceCompletionRecord,MaintenanceTimelineEvent} from './types';
export const sampleMaintenanceProfiles:PrinterMaintenanceProfile[]=initialEquipment.map(p=>({printerId:p.id,assetTag:p.id,nickname:p.name,printerModel:p.model,customerName:'SFX/MPX',siteName:p.location,currentCopyCount:null,previousCopyCount:null,monthlyVolume:null,lastPMDate:null,lastCleaningDate:null,lastJointUnitDate:null,lastDTFPMDate:null,nextPMDue:null,nextCleaningDue:null,nextJointUnitDue:null,nextDTFDue:null,lastPMCopyCount:null,lastCleaningCopyCount:null,lastJointUnitCopyCount:null,lastDTFPMCopyCount:null,nextPMDueCount:null,nextCleaningDueCount:null,nextJointUnitDueCount:null,nextDTFDueCount:null}));
export const sampleCopyCountHistory:CopyCountHistory[]=[];
export const sampleMaintenanceCompletions:MaintenanceCompletionRecord[]=[];
export const sampleMaintenanceTimeline:MaintenanceTimelineEvent[]=[];
