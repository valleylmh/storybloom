"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { upsertCloudFavoriteRecords } from "@/lib/cloud-reading-state";
import {
  createFavoriteKey,
  FAVORITES_CHANGED_EVENT,
  isFavorite,
  listFavoriteRecords,
  setFavorite,
  type FavoriteRecord,
} from "@/lib/favorites";
import type { StoryContentType } from "@/lib/reading-progress";
import { isReadingSyncEnabled } from "@/lib/reading-sync-preference";

export function useFavorites() {
  const { supabase, user } = useAuth();
  const [records, setRecords] = useState<FavoriteRecord[]>([]);

  useEffect(() => {
    const refresh = () => setRecords(listFavoriteRecords());
    refresh();
    window.addEventListener(FAVORITES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const keys = useMemo(
    () =>
      new Set(
        records.map((record) =>
          createFavoriteKey(record.contentType, record.contentId),
        ),
      ),
    [records],
  );

  const toggle = useCallback(
    (contentType: StoryContentType, contentId: string) => {
      const record = setFavorite(
        contentType,
        contentId,
        !isFavorite(contentType, contentId),
      );
      if (isReadingSyncEnabled() && supabase && user) {
        void upsertCloudFavoriteRecords(supabase, user.id, [record]).catch(
          () => undefined,
        );
      }
      return !record.deletedAt;
    },
    [supabase, user],
  );

  return { records, keys, toggle };
}
