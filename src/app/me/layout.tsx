import type { Metadata } from "next";
import type { ReactNode } from "react";
import AccountShell from "@/components/account/AccountShell";

export const metadata: Metadata = {
  title: "我的家庭 | StoryBloom",
  description: "查看当前浏览器里的绘本、成长记录与家庭资料。",
};

export default function MeLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
