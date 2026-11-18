"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Books, CalendarDots, House, MagicWand } from "@phosphor-icons/react";

function isReaderDetail(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "en") parts.shift();
  return parts[0] === "library" && parts.length >= 3 && parts[1] !== "topics";
}

export default function FamilyPlatformNav() {
  const pathname = usePathname();
  if (
    isReaderDetail(pathname) ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/login"
  ) {
    return null;
  }

  const items = [
    { href: "/library", label: "绘本馆", icon: Books, active: pathname.startsWith("/library") },
    { href: "/#story-creation", label: "创作", icon: MagicWand, active: pathname === "/" },
    { href: "/me", label: "成长", icon: CalendarDots, active: pathname === "/me" || pathname.startsWith("/me/growth") },
    { href: "/me/books", label: "书架", icon: House, active: pathname.startsWith("/me/books") },
  ];

  const english = pathname === "/en" || pathname.startsWith("/en/");
  const navigation = english ? [
    { href: "/en/library", label: "Library", icon: Books, active: pathname.startsWith("/en/library") },
    { href: "/en#story-creation", label: "Create", icon: MagicWand, active: pathname === "/en" },
    { href: "/me", label: "Moments", icon: CalendarDots, active: false },
    { href: "/me/books", label: "My books", icon: House, active: false },
  ] : items;

  return (
    <nav className="family-platform-nav" lang={english ? "en" : "zh-CN"} aria-label={english ? "Family story navigation" : "家庭故事平台主导航"}>
      {navigation.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
          >
            <Icon aria-hidden="true" weight={item.active ? "fill" : "regular"} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
