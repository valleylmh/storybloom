"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useAccountSync } from "./AccountSyncProvider";
export default function AccountSyncStatus() {
  const { session } = useAuth();
  const sync = useAccountSync();
  return <section className="account-sync-status" aria-label="账号同步状态">
    <p role="status">{sync.message}</p>
    {session ? <button type="button" disabled={sync.loading} onClick={() => void sync.refresh()}>{sync.loading ? "同步中…" : "立即同步"}</button> : <Link href="/login?next=%2Fme%2Fbooks">登录并同步</Link>}
    {sync.needsPhotoConsent ? <label><input type="checkbox" onChange={(event) => { if (event.target.checked) sync.allowPhotos(); }} />我是监护人，已获授权将这些成长记录及现场照片保存到当前账号，用于跨设备同步。</label> : null}
    {sync.message.includes("同时修改") ? <Link href="/me/settings#local-data-import">处理版本冲突</Link> : null}
  </section>;
}
