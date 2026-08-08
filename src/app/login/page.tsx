import type { Metadata } from "next";
import LoginPanel from "@/components/auth/LoginPanel";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

export const metadata: Metadata = {
  title: "登录 | StoryBloom",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = sanitizeReturnTo(requestedNext);

  return (
    <main className="family-page family-centered">
      <LoginPanel next={next} />
    </main>
  );
}
