"use client";
import { useAuth } from "@/hooks/useAuth";
import GrowthTimeline from "./GrowthTimeline";
import UnifiedGrowthTimeline from "./UnifiedGrowthTimeline";
import type { GrowthDataSource } from "./growth-source-model";

export default function AccountGrowthTimeline(props: {
  childKey: string;
  source: GrowthDataSource;
  momentId?: string;
}) {
  const { session, loading } = useAuth();
  if (loading) return <p role="status">正在读取账号…</p>;
  return session ? <UnifiedGrowthTimeline childKey={props.childKey} /> : <GrowthTimeline childKey={props.childKey} momentId={props.momentId} embedded basePath="/me" />;
}
