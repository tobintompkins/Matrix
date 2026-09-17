import { NextResponse } from 'next/server';
import { requireMatrixPermission } from '@/lib/auth/server';
import { hasMatrixPermission } from '@/lib/auth/permissions';
import { readCatalog, saveCatalog } from '@/lib/equipment/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() {
 const auth=await requireMatrixPermission('VIEW_DIGITAL_TWIN'); if(!auth.ok) return auth.response;
 try { return NextResponse.json({...readCatalog(),canEdit:hasMatrixPermission(auth.profile.role,'EDIT_DIGITAL_TWIN')}); }
 catch { return NextResponse.json({error:'Unable to load the printer list.'},{status:500}); }
}
export async function PUT(request: Request) {
 const auth=await requireMatrixPermission('EDIT_DIGITAL_TWIN'); if(!auth.ok) return auth.response;
 if(request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({error:'Invalid request origin.'},{status:403});
 let body; try { body=await request.json(); } catch { return NextResponse.json({error:'Invalid printer data.'},{status:400}); }
 if(!Number.isSafeInteger(body?.revision) || body.revision<0) return NextResponse.json({error:'Invalid list revision.'},{status:400});
 try { return NextResponse.json({...saveCatalog(body.revision,body.equipment),canEdit:true}); }
 catch(error) { const message=error instanceof Error?error.message:'Unable to save printers.';
 if(message==='CONFLICT') return NextResponse.json({error:'Another user changed this list. Reload before saving.'},{status:409});
 const validation=/printer|serial|engine|removal|Duplicate|Select|list|Enter|details/i.test(message);
 return NextResponse.json({error:validation?message:'Unable to save printers. Please try again.'},{status:validation?400:500}); }
}
