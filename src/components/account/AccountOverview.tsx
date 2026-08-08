"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Books,
  GearSix,
  Lightbulb,
  TreeStructure,
  UsersThree,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";
import { countFamilyCharacters } from "@/lib/repositories/family-character-repository";
import CloudSyncCard from "./CloudSyncCard";
import LocalImportCard from "./LocalImportCard";
import LocalDataSummary from "./LocalDataSummary";
import { createAccountLocalImportController } from "./local-import-adapter";
import styles from "./Account.module.css";

const FEATURE_ITEMS = [
  {
    href: "/me/books",
    title: "我的绘本",
    description: "并列查看当前设备与主动导入云端的绘本副本。",
    icon: Books,
  },
  {
    href: "/me/growth",
    title: "成长记录",
    description: "切换查看当前设备或私有云端的照片、备注和绘本场景。",
    icon: TreeStructure,
  },
  {
    href: "/me/characters",
    title: "家庭角色",
    description: "管理孩子、父母、长辈或宠物，需要登录后使用。",
    icon: UsersThree,
  },
  {
    href: "/?mode=minimal",
    title: "今日灵感",
    description: "回到一句话创作入口，继续生成新的家庭故事。",
    icon: Lightbulb,
  },
  {
    href: "/me/settings",
    title: "数据与隐私",
    description: "查看保存位置，并管理可选同步与隐私设置。",
    icon: GearSix,
  },
];

export default function AccountOverview() {
  const { supabase, session, loading } = useAuth();
  const [cloudCharacterCount, setCloudCharacterCount] = useState<number | null>();
  const userId = session?.user.id;
  const localImportController = useMemo(() => {
    if (!supabase || !userId) return null;
    return createAccountLocalImportController(supabase, userId);
  }, [supabase, userId]);

  useEffect(() => {
    let active = true;
    if (!supabase || !session) {
      setCloudCharacterCount(undefined);
      return () => {
        active = false;
      };
    }

    setCloudCharacterCount(null);
    void countFamilyCharacters(supabase, session.user.id)
      .then((count) => {
        if (active) setCloudCharacterCount(count);
      })
      .catch(() => {
        if (active) setCloudCharacterCount(undefined);
      });

    return () => {
      active = false;
    };
  }, [session, supabase]);

  return (
    <main className={styles.overview}>
      <LocalDataSummary
        showCloudCharacters={!loading && Boolean(session)}
        cloudCharacterCount={cloudCharacterCount}
      />

      {!loading && userId && localImportController ? (
        <div id="local-data-import">
          <LocalImportCard
            controller={localImportController}
            userId={userId}
          />
        </div>
      ) : null}

      <div className={styles.actions}>
        <Link className={styles.primaryButton} href="/?mode=minimal">
          继续创作 <ArrowRight />
        </Link>
        {!loading && !session ? (
          <Link className={styles.secondaryButton} href={buildLoginPath("/me")}>
            登录并跨设备保存
          </Link>
        ) : null}
        {!loading && !session ? (
          <p className={styles.actionNote}>
            登录后仍不会自动上传；你可以进入账户页逐项选择要跨设备保存的内容。
          </p>
        ) : null}
      </div>

      <nav className={styles.featureGrid} aria-label="我的家庭功能">
        {FEATURE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link className={styles.featureCard} href={item.href} key={item.title}>
              <span className={styles.featureIcon}>
                <Icon size={21} />
              </span>
              <span className={styles.featureCopy}>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </span>
              <ArrowRight />
            </Link>
          );
        })}
      </nav>

      <CloudSyncCard />
    </main>
  );
}
