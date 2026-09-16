"use client";
import { useAuth } from "@/hooks/useAuth";
import LocalGrowthJournal from "./LocalGrowthJournal";
import UnifiedGrowthLibrary from "./UnifiedGrowthLibrary";
import type { GrowthDataSource } from "./growth-source-model";

// Accept old source links while presenting one account shelf.
export default function AccountGrowthLibrary(_props: { requestedSource?: GrowthDataSource }) {
  const { session, loading } = useAuth();
  if (loading) return <p role="status">正在读取账号…</p>;
  return session ? <UnifiedGrowthLibrary /> : <LocalGrowthJournal />;
}
