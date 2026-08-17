"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Books, CalendarDots, House, MagicWand } from "@phosphor-icons/react";

function isReaderDetail(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "library" && parts.length >= 3;
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
    { href: "/growth", label: "成长", icon: CalendarDots, active: pathname.startsWith("/growth") },
    { href: "/me/books", label: "书架", icon: House, active: pathname.startsWith("/me/books") },
  ];

  return (
    <nav className="family-platform-nav" aria-label="家庭故事平台主导航">
      {items.map((item) => {
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
