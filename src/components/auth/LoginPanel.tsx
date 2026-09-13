"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, SpinnerGap } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeReturnTo } from "@/lib/auth/return-to";

export type LoginPanelVariant = "default" | "family";

export default function LoginPanel({
  next = "/",
  variant = "default",
}: {
  next?: string;
  variant?: LoginPanelVariant;
}) {
  const { session, loading, error: authError, sendEmailCode, verifyEmailCode } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const pending = useRef(false);
  const router = useRouter();
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const returnTo = sanitizeReturnTo(next);
  const family = variant === "family";

  async function sendCode() {
    if (pending.current || Date.now() < retryAt) return;
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      await sendEmailCode(email);
      setEmail(email.trim());
      setSent(true);
      setCode("");
      setRetryAt(Date.now() + 60_000);
    } catch {
      setNotice("验证码发送失败，请检查邮箱；若操作频繁，请稍后重试。");
      setRetryAt(Date.now() + 60_000);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCode();
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      await verifyEmailCode(email, code);
      router.replace(returnTo);
    } catch {
      setNotice("验证码无效或已过期，请检查邮件中的最新验证码，或重新发送。");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="family-login-shell">
      <div className="family-login">
        <Link href="/" className="family-back">
          <ArrowLeft /> 返回首页
        </Link>
        <Link href="/" className="family-login-brand">
          StoryBloom<span>{family ? "家庭角色库" : "我的账户"}</span>
        </Link>
        <p className="family-kicker">
          {family ? "PRIVATE FAMILY LIBRARY" : "YOUR STORYBLOOM ACCOUNT"}
        </p>
        <h1>
          {family ? (
            <>
              把最熟悉的人，<br />写进每一页故事里
            </>
          ) : (
            <>
              登录后，继续管理<br />属于你的故事
            </>
          )}
        </h1>
        <p>
          {family
            ? "保存一次家庭角色，以后只用一句话，就能让孩子和家人一起走进新的绘本冒险。"
            : "登录后，绘本和成长记录会保存到同一账号，并在电脑和手机间自动同步；未登录也可以创作。"}
        </p>

        {session ? (
          <div className="family-mail-sent">
            <CheckCircle size={24} />
            <span>
              已登录为<br />
              <strong>{session.user.email || "StoryBloom 用户"}</strong>
            </span>
            <small>
              <Link href={returnTo}>继续前往原页面</Link>
            </small>
          </div>
        ) : sent ? (
          <div>
            <p role="status">验证码已发送至 <strong>{email}</strong>，请输入邮件中的数字验证码。</p>
            <form onSubmit={handleVerify}>
              <label>
                <span>邮箱验证码</span>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus required
                  pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="输入验证码" disabled={busy} />
              </label>
              <button disabled={busy || loading}>{busy ? "正在验证…" : "验证并登录"}</button>
            </form>
            <div className="email-code-actions">
              <button type="button" disabled={busy || seconds > 0} onClick={() => void sendCode()}>
                {seconds > 0 ? `${seconds} 秒后可重发` : "重新发送"}
              </button>
              <button type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); setNotice(""); }}>更换邮箱</button>
            </div>
            <p>没有收到？请检查垃圾邮件。新邮箱验证后将自动注册。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              <span>家长邮箱</span>
              <input
                disabled={busy}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>
            <button disabled={busy || loading || seconds > 0}>
              {busy || loading ? <SpinnerGap className="spin" /> : seconds > 0 ? `${seconds} 秒后可重发` : "发送验证码"}
            </button>
          </form>
        )}

        {notice || authError ? (
          <p className="family-error" role="alert">{notice || authError}</p>
        ) : null}
        <small className="family-privacy">
          <span>私</span>无需密码，新邮箱验证后自动注册；仅家长可以管理账户与家庭资料
        </small>
      </div>
      <aside className="family-login-visual" aria-hidden="true">
        <div className="family-orbit family-orbit-one" />
        <div className="family-orbit family-orbit-two" />
        <div className="family-portrait family-portrait-child"><span>孩子</span></div>
        <div className="family-portrait family-portrait-parent"><span>家人</span></div>
        <div className="family-portrait family-portrait-pet"><span>宠物</span></div>
        <div className="family-visual-copy">
          <p>{family ? "一次创建，反复使用" : "匿名创作，登录管理"}</p>
          <strong>
            {family ? (
              <>每个新故事，<br />都有熟悉的人。</>
            ) : (
              <>创作不设门槛，<br />账户始终可选。</>
            )}
          </strong>
        </div>
      </aside>
    </section>
  );
}
