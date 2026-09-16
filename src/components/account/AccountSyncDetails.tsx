"use client";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import LocalImportCard from "./LocalImportCard";
import { createAccountLocalImportController } from "./local-import-adapter";
import AccountSyncStatus from "@/components/sync/AccountSyncStatus";
export default function AccountSyncDetails() {
  const { supabase, session } = useAuth();
  const userId = session?.user.id;
  const controller = useMemo(() => supabase && userId ? createAccountLocalImportController(supabase, userId) : null, [supabase, userId]);
  return <section><AccountSyncStatus />{controller && userId ? <details id="local-data-import"><summary>同步详情与版本冲突</summary><LocalImportCard controller={controller} userId={userId} /></details> : null}</section>;
}
