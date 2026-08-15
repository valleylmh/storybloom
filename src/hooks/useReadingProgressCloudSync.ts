"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { upsertCloudReadingProgress } from "@/lib/cloud-reading-state";
import type { ReadingProgressRecord } from "@/lib/reading-progress";
import {
  isReadingSyncEnabled,
  READING_SYNC_CHANGED_EVENT,
} from "@/lib/reading-sync-preference";

const CLOUD_POSITION_SYNC_INTERVAL_MS = 15_000;

export function useReadingProgressCloudSync() {
  const { supabase, user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    const refresh = () => setEnabled(isReadingSyncEnabled());
    refresh();
    window.addEventListener(READING_SYNC_CHANGED_EVENT, refresh);
    return () =>
      window.removeEventListener(READING_SYNC_CHANGED_EVENT, refresh);
  }, []);

  return useCallback(
    (record: ReadingProgressRecord, status?: string) => {
      if (!enabled || !supabase || !user) return;
      const now = Date.now();
      const terminal =
        status === "paused" ||
        status === "ended" ||
        status === "error" ||
        status === "idle";
      if (!terminal && now - lastSyncAtRef.current < CLOUD_POSITION_SYNC_INTERVAL_MS) {
        return;
      }
      lastSyncAtRef.current = now;
      void upsertCloudReadingProgress(supabase, user.id, [record]).catch(
        () => undefined,
      );
    },
    [enabled, supabase, user],
  );
}
