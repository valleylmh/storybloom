"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    sync();
    display.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      display.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    setBusy(true);
    try { await prompt.prompt(); await prompt.userChoice; }
    finally { setPrompt(null); setBusy(false); }
  }
  return <main className="webapp-install">
    <Link href="/library">← 返回绘本馆</Link>
    <img src="/icons/icon-192.png" width="88" height="88" alt="StoryBloom 应用图标" />
    <h1>把绘本馆放到主屏幕</h1>
    <p>轻点图标，像打开 App 一样开始亲子共读。</p>
    {installed ? <p role="status">已在独立应用窗口中打开，或已完成安装。</p> : <>
      {prompt && <button onClick={() => void install().catch(() => {})} disabled={busy}>{busy ? "正在打开安装窗口…" : "安装 StoryBloom"}</button>}
      <h2>iPhone / iPad</h2><p>用 Safari 打开本站，点击“分享” → “添加到主屏幕”。若显示“作为 Web App 打开”，请保持开启。</p>
      <h2>Android</h2><p>用 Chrome 打开本站，点击浏览器菜单中的“安装应用”或“添加到主屏幕”。微信内请先选择在系统浏览器中打开。</p>
    </>}
    <h2>更轻快，也更安心</h2>
    <p>自动缓存已加载的公共图片和页面静态资源，减少重复下载；断网时显示离线提示页。缓存空间有限，系统也可能自动清理。</p>
    <p>这不等于完整绘本离线下载。打开页面、创作、云端同步和在线朗读仍需联网。家庭照片、账号接口和私人页面不会加入应用缓存。</p>
  </main>;
}
