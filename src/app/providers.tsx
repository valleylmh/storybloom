"use client";

import type { ReactNode } from "react";
import AuthProvider from "@/components/auth/AuthProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
