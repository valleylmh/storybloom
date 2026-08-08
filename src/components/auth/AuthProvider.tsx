"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { buildAuthCallbackUrl, sanitizeReturnTo } from "@/lib/auth/return-to";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthContextValue = {
  supabase: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithMagicLink: (email: string, returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    try {
      const client = getSupabaseBrowserClient();
      setSupabase(client);

      void client.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setSession(data.session);
        setLoading(false);
      });

      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setError(null);
        setLoading(false);
      });

      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户服务初始化失败");
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, []);

  const signInWithMagicLink = useCallback(
    async (email: string, returnTo = "/") => {
      if (!supabase) throw new Error(error || "账户服务尚未准备好，请稍后再试");

      const callbackUrl = buildAuthCallbackUrl(
        window.location.origin,
        sanitizeReturnTo(returnTo),
      );
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl },
      });
      if (signInError) throw signInError;
    },
    [error, supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    setSession(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user || null,
      loading,
      error,
      signInWithMagicLink,
      signOut,
    }),
    [error, loading, session, signInWithMagicLink, signOut, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
