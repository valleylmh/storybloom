"use client";

import { useEffect, useState } from "react";
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
import LocalDataSummary from "./LocalDataSummary";
import styles from "./Account.module.css";

const FEATURE_ITEMS = [
  {
    href: "/me/books",
    title: "我的绘本",
    description: "查看、继续阅读或删除当前浏览器里的最近作品。",
    icon: Books,
  },
  {
    href: "/me/growth",
    title: "成长记录",
    description: "按孩子查看真实照片、家长备注和绘本场景。",
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
    description: "了解本地保存边界、账户数据和后续同步计划。",
    icon: GearSix,
  },
];

export default function AccountOverview() {
  const { supabase, session, loading } = useAuth();
  const [cloudCharacterCount, setCloudCharacterCount] = useState<number | null>();

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
            登录先用于账户与家庭角色；本地绘本和成长记录的跨设备同步仍在开发中。
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
