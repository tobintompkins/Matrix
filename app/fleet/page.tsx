import MatrixShell from '../components/MatrixShell';
import MatrixAuthGuard from '../components/MatrixAuthGuard';
import EquipmentManager from './EquipmentManager';
export default function FleetPage(){ return <MatrixShell title="Printer Fleet" activePath="/fleet"><MatrixAuthGuard requiredPermissions={['VIEW_DIGITAL_TWIN']}><h1 className="mb-4 text-3xl font-semibold">Printer Fleet</h1><EquipmentManager/></MatrixAuthGuard></MatrixShell>; }
