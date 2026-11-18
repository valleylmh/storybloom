"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { zh: "绘本馆", en: "Library", href: "/library", enHref: "/en/library" },
  { zh: "创作", en: "Create", href: "/#story-creation", enHref: "/en#story-creation" },
  { zh: "每日灵感", en: "Daily ideas", href: "/inspiration", enHref: "/en/inspiration" },
  { zh: "绘本定制工作台", en: "Custom book studio", href: "/custom" },
  { zh: "添加到主屏幕", en: "Add to Home Screen", href: "/install" },
  { zh: "隐私与数据", en: "Privacy & data", href: "/privacy" },
  { zh: "分析设置", en: "Analytics settings", href: "/privacy#analytics-controls" },
  { zh: "儿童与家庭数据", en: "Children & family data", href: "/child-family-data" },
];

export default function Footer() {
  const pathname = usePathname();
  const english = pathname === "/en" || pathname.startsWith("/en/");

  return (
    <footer className="site-footer" lang={english ? "en" : undefined}>
      <div className="footer-inner">
        <span className="footer-text">
          {new Date().getFullYear()}&copy; StoryBloom
        </span>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={english ? link.enHref ?? link.href : link.href}
            // Pages without an English version stay reachable and say so.
            hrefLang={english && !link.enHref ? "zh-CN" : undefined}
            className="footer-link"
          >
            {english ? link.en : link.zh}
          </Link>
        ))}
      </div>
    </footer>
  );
}
