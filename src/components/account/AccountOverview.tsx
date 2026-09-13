"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Books,
  GearSix,
  ShieldCheck,
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
import AccountTodayInspiration from "@/components/inspiration/AccountTodayInspiration";
import styles from "./Account.module.css";

const FEATURE_ITEMS = [
  {
    href: "/me/books",
    title: "我的绘本",
    description: "查看同一账号的绘本，电脑和手机自动同步。",
    icon: Books,
  },
  {
    href: "/me/growth",
    title: "成长记录",
    description: "把照片、备注和绘本场景留在同一份成长记录里。",
    icon: TreeStructure,
  },
  {
    href: "/me/characters",
    title: "家庭角色",
    description: "管理孩子、父母、长辈或宠物，需要登录后使用。",
    icon: UsersThree,
  },
  {
    href: "/me/settings",
    title: "数据与隐私",
    description: "查看保存位置，并管理导出、删除与可选同步偏好。",
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

      <section className={styles.dataBoundaryNote} aria-labelledby="account-data-boundary-title">
        <span className={styles.dataBoundaryIcon} aria-hidden="true">
          <ShieldCheck size={23} weight="duotone" />
        </span>
        <div>
          <h2 id="account-data-boundary-title">一个账号，一份家庭记录</h2>
          <p>
            登录后自动同步绘本与成长记录；本机缓存用于离线查看。含现场照片的旧记录会在首次授权后同步。
          </p>
        </div>
      </section>

      {!loading && userId && localImportController ? (
        <details id="local-data-import"><summary>同步详情与版本冲突</summary>
          <LocalImportCard
            controller={localImportController}
            userId={userId}
          />
        </details>
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
      </div>

      <AccountTodayInspiration />

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
