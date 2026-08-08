"use client";

import Link from "next/link";
import { UserCircle } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";

export default function AccountEntryButton({
  locale = "zh",
  returnTo = "/family",
}: {
  locale?: "zh" | "en";
  returnTo?: string;
}) {
  const { session } = useAuth();
  const href = session ? returnTo : buildLoginPath(returnTo);
  const label = locale === "zh" ? "我的" : "Account";

  return (
    <Link className="account-entry-button" href={href} title={session?.user.email}>
      <UserCircle size={18} />
      <span>{label}</span>
    </Link>
  );
}
