import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "家庭角色库 | StoryBloom",
  robots: { index: false, follow: true },
};

export default function FamilyLayout({ children }: { children: ReactNode }) {
  return children;
}
