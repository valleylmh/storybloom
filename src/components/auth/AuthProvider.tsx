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

import { setActiveRecordOwner } from "@/lib/sync/account-ownership";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthContextValue = {
  supabase: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  sendEmailCode: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, token: string) => Promise<void>;
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
        setActiveRecordOwner(data.session?.user.id || null);
        setSession(data.session);
        setLoading(false);
      });

      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setActiveRecordOwner(nextSession?.user.id || null);
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

  const sendEmailCode = useCallback(async (email: string) => {
    if (!supabase) throw new Error(error || "账户服务尚未准备好，请稍后再试");
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(), options: { shouldCreateUser: true },
    });
    if (sendError) throw sendError;
  }, [error, supabase]);

  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    if (!supabase) throw new Error(error || "账户服务尚未准备好，请稍后再试");
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(), token: token.trim(), type: "email",
    });
    if (verifyError) throw verifyError;
    if (!data.session) throw new Error("登录未完成，请重新验证");
    setActiveRecordOwner(data.session?.user.id || null);
    setSession(data.session);
  }, [error, supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    setActiveRecordOwner(null);
    setSession(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user || null,
      loading,
      error,
      sendEmailCode,
      verifyEmailCode,
      signOut,
    }),
    [error, loading, session, sendEmailCode, verifyEmailCode, signOut, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
