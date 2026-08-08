"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeviceMobile, SignIn, SignOut, UserCircle } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";
import styles from "./Account.module.css";

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/me/books")) return "我的绘本";
  if (pathname.startsWith("/me/growth")) return "成长记录";
  if (pathname.startsWith("/me/characters")) return "家庭角色";
  if (pathname.startsWith("/me/settings")) return "数据与隐私";
  return "我的家庭";
}

export default function AccountHeader() {
  const pathname = usePathname();
  const { session, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = getPageTitle(pathname);

  async function handleSignOut() {
    setBusy(true);
    setError("");
    try {
      await signOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "退出失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <p>STORYBLOOM FAMILY</p>
        <h1>{title}</h1>
      </div>
      <div>
        <div className={styles.headerActions}>
          <div className={styles.identity}>
            <span className={styles.identityIcon}>
              {session ? <UserCircle size={22} /> : <DeviceMobile size={21} />}
            </span>
            <span className={styles.identityCopy}>
              <span>{session ? "登录邮箱" : "当前设备"}</span>
              <strong>
                {loading
                  ? "正在读取账户状态"
                  : session?.user.email || "本地浏览器资料"}
              </strong>
            </span>
          </div>
          {!loading && session ? (
            <button
              type="button"
              className={styles.headerButton}
              disabled={busy}
              onClick={() => void handleSignOut()}
            >
              <SignOut /> {busy ? "退出中" : "退出"}
            </button>
          ) : !loading ? (
            <Link className={styles.headerButton} href={buildLoginPath(pathname)}>
              <SignIn /> 登录
            </Link>
          ) : null}
        </div>
        {error ? <p className={styles.headerError}>{error}</p> : null}
      </div>
    </header>
  );
}
