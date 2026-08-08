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
          <h2>{session ? "按你的选择同步" : "登录后可选择云同步"}</h2>
        </div>
        <p>
          {session
            ? "登录不会自动上传本地内容。你可以逐项选择绘本和成长记录导入云端，中断后继续，本地副本会一直保留。"
            : "当前浏览器里的绘本和成长记录仍保存在本机；登录后也只有你主动选择的内容才会导入云端。"}
        </p>
      </div>
      <Link
        className={styles.cardLink}
        href={session ? "/me#local-data-import" : buildLoginPath("/me")}
      >
        {session ? "管理导入内容" : "先建立账户"} <ArrowRight />
      </Link>
    </section>
  );
}
