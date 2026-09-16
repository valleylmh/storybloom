"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Books,
  GearSix,
  Lightbulb,
  TreeStructure,
  UsersThree,
} from "@phosphor-icons/react";
import styles from "./Account.module.css";

const NAV_ITEMS = [
  { href: "/me", label: "成长记录", icon: TreeStructure, exact: true },
  { href: "/me/books", label: "我的绘本", icon: Books },
  { href: "/me/characters", label: "家庭角色", icon: UsersThree },
  { href: "/me/inspiration", label: "今日灵感", icon: Lightbulb, exact: true },
  { href: "/me/settings", label: "数据与隐私", icon: GearSix },
];

export default function AccountSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>
        StoryBloom
        <small>我的家庭</small>
      </Link>
      <nav className={styles.nav} aria-label="个人中心导航">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href || (item.href === "/me" && pathname.startsWith("/me/growth"))
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              aria-current={active ? "page" : undefined}
              key={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className={styles.sidebarNote}>
        <strong>家庭记录</strong>
        <span>登录后自动同步，离线时可查看设备缓存。同步与数据管理请前往“数据与隐私”。</span>
      </div>
    </aside>
  );
}
