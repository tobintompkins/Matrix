'use client';
import { useCallback, useEffect, useState } from 'react';
import { type Catalog, type Equipment } from './catalog';
export function useCatalog() {
 const [catalog,setCatalog]=useState<Catalog>({revision:0,equipment:[]}), [loading,setLoading]=useState(true), [error,setError]=useState(''), [saving,setSaving]=useState(false);
 const reload=useCallback(async()=>{ try { const response=await fetch('/api/equipment',{cache:'no-store'}); const data=await response.json(); if(!response.ok) throw new Error(data.error||'Unable to load printers.'); setCatalog(data); setError(''); } catch(e){setError(e instanceof Error?e.message:'Unable to load printers.');} finally {setLoading(false);} },[]);
 useEffect(()=>{ const timer=window.setTimeout(()=>void reload(),0); const refresh=()=>void reload(); window.addEventListener('focus',refresh); return ()=>{window.clearTimeout(timer);window.removeEventListener('focus',refresh);}; },[reload]);
 async function save(equipment: Equipment[]) {
  setSaving(true); setError(''); try { const response=await fetch('/api/equipment',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:catalog.revision,equipment})}); const data=await response.json(); if(!response.ok) throw new Error(data.error||'Unable to save printers.'); setCatalog(data); return true; } catch(e){setError(e instanceof Error?e.message:'Unable to save printers.');return false;} finally {setSaving(false);}
 }
 return {catalog,loading,error,saving,save,reload};
}
