"use client";
import { useEffect, useState } from "react";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import type { GrowthRecord } from "@/lib/growth-records";
import GrowthJournal from "./GrowthJournal";
import GrowthArchiveControls from "./GrowthArchiveControls";
export default function LocalGrowthJournal() {
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => { void localGrowthRepository.list().then(rows => { if(active) { setRecords(rows); setError(false); } }).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);}); };
    load(); window.addEventListener("focus", load); window.addEventListener("storybloom:account-data-dirty", load);
    return ()=>{active=false;window.removeEventListener("focus", load);window.removeEventListener("storybloom:account-data-dirty", load);};
  }, []);
  return <main><GrowthJournal records={records} loading={loading} local error={error} /><details className="growth-sync-details"><summary>本机记录备份与管理</summary><GrowthArchiveControls onArchiveChanged={async()=>{try{setRecords(await localGrowthRepository.list());setError(false);}catch{setError(true);}}} /></details></main>;
}
