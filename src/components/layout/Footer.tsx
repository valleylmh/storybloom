import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span className="footer-text">
          {new Date().getFullYear()}&copy; StoryBloom
        </span>
        <Link href="/library" className="footer-link">
          绘本馆
        </Link>
        <Link href="/inspiration" className="footer-link">
          每日灵感
        </Link>
        <Link href="/custom" className="footer-link">
          绘本定制
        </Link>
        <Link href="/privacy" className="footer-link">
          隐私与数据
        </Link>
        <Link href="/privacy#analytics-controls" className="footer-link">
          分析设置
        </Link>
        <Link href="/child-family-data" className="footer-link">
          儿童与家庭数据
        </Link>
      </div>
    </footer>
  );
}
