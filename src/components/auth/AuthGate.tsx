"use client";

import type { ReactNode } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import LoginPanel, { type LoginPanelVariant } from "./LoginPanel";

export default function AuthGate({
  children,
  next = "/",
  loginVariant = "default",
  loadingFallback,
  inline = false,
  className,
}: {
  children: ReactNode;
  next?: string;
  loginVariant?: LoginPanelVariant;
  loadingFallback?: ReactNode;
  inline?: boolean;
  className?: string;
}) {
  const { session, loading } = useAuth();

  if (loading) {
    return loadingFallback ?? (
      <main className="family-page family-centered" aria-label="正在检查登录状态">
        <SpinnerGap className="spin" size={28} />
      </main>
    );
  }

  if (!session) {
    if (inline) {
      return (
        <section className={className}>
          <LoginPanel next={next} variant={loginVariant} />
        </section>
      );
    }

    return (
      <main className="family-page family-centered">
        <LoginPanel next={next} variant={loginVariant} />
      </main>
    );
  }

  return children;
}
