"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildLoginPath, sanitizeReturnTo } from "@/lib/auth/return-to";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      const url = new URL(window.location.href);
      const requestedNext = sanitizeReturnTo(url.searchParams.get("next"));
      const next = requestedNext.split(/[?#]/, 1)[0] === "/auth/callback"
        ? "/"
        : requestedNext;
      setReturnTo(next);

      const providerError =
        url.searchParams.get("error_description") || url.searchParams.get("error");
      if (providerError) throw new Error(providerError);

      const code = url.searchParams.get("code");
      const supabase = getSupabaseBrowserClient();

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("登录链接无效或已过期，请重新发送。");
      }

      if (active) window.location.replace(next);
    }

    void completeSignIn().catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "登录失败，请重新发送链接。");
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="auth-callback-page">
      <section className="auth-callback-card" role="status">
        {error ? (
          <>
            <WarningCircle size={34} />
            <h1>登录没有完成</h1>
            <p>{error}</p>
            <Link href={buildLoginPath(returnTo)}>重新发送登录链接</Link>
          </>
        ) : (
          <>
            <span className="auth-callback-spinner">
              <SpinnerGap className="spin" size={34} />
              <CheckCircle size={18} weight="fill" />
            </span>
            <h1>正在完成登录</h1>
            <p>验证成功后会自动返回原页面。</p>
          </>
        )}
      </section>
    </main>
  );
}
