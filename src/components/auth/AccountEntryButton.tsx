"use client";

import Link from "next/link";
import { UserCircle } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";

export default function AccountEntryButton({
  locale = "zh",
  returnTo = "/me",
}: {
  locale?: "zh" | "en";
  returnTo?: string;
}) {
  const { session } = useAuth();
  const label = locale === "zh" ? "我的" : "Account";

  return (
    <Link className="account-entry-button" href={returnTo} title={session?.user.email}>
      <UserCircle size={18} />
      <span>{label}</span>
    </Link>
  );
}
