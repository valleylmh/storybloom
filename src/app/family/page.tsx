"use client";

import dynamic from "next/dynamic";

// Supabase auth reads NEXT_PUBLIC_* configuration and browser storage.
// Keep the family library entirely client-side so Next.js does not construct
// its browser client while prerendering this route during deployment.
const FamilyLibrary = dynamic(
  () => import("@/components/family/FamilyLibrary"),
  {
    ssr: false,
    loading: () => (
      <main className="family-page family-centered" aria-label="正在加载家庭角色库" />
    ),
  },
);

export default function FamilyPage() {
  return <FamilyLibrary />;
}
