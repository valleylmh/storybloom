"use client";

import Link from "next/link";
import { ArrowRight, CloudArrowUp } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";
import styles from "./Account.module.css";

export default function CloudSyncCard() {
  const { session } = useAuth();

  return (
    <section className={styles.cloudCard}>
      <span className={styles.cloudIcon}>
        <CloudArrowUp size={22} />
      </span>
      <div className={styles.cloudCopy}>
        <div className={styles.cloudHeader}>
          <h2>云同步即将支持</h2>
        </div>
        <p>
          {session
            ? "家庭角色已绑定账户；当前浏览器里的绘本与成长记录仍不会因登录自动上传，跨设备同步将在后续版本接入。"
            : "现在登录可以管理云端家庭角色，但当前浏览器里的绘本与成长记录仍只保存在这台设备。"}
        </p>
      </div>
      <Link
        className={styles.cardLink}
        href={session ? "/me/characters" : buildLoginPath("/me")}
      >
        {session ? "管理家庭角色" : "先建立账户"} <ArrowRight />
      </Link>
    </section>
  );
}
