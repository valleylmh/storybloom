"use client";

import type { ReactNode } from "react";
import AccountSyncProvider from "@/components/sync/AccountSyncProvider";
import AuthProvider from "@/components/auth/AuthProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider><AccountSyncProvider>{children}</AccountSyncProvider></AuthProvider>;
}
