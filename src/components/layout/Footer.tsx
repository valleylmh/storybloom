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
        <Link href="/custom" className="footer-link">
          绘本定制
        </Link>
      </div>
    </footer>
  );
}
