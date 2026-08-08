"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
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
  const { session, loading, error: authError, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const returnTo = sanitizeReturnTo(next);
  const family = variant === "family";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await signInWithMagicLink(email, returnTo);
      setSent(true);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "登录链接发送失败");
    } finally {
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
            : "匿名状态仍可直接生成绘本；登录只用于管理家庭角色和需要账户保存的内容。"}
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
          <div className="family-mail-sent">
            <CheckCircle size={24} />
            <span>
              登录链接已发送至<br />
              <strong>{email}</strong>
            </span>
            <small>请打开邮件完成登录，完成后会自动返回原页面。</small>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              <span>家长邮箱</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>
            <button disabled={busy || loading}>
              {busy || loading ? <SpinnerGap className="spin" /> : "发送登录链接"}
            </button>
          </form>
        )}

        {notice || authError ? (
          <p className="family-error">{notice || authError}</p>
        ) : null}
        <small className="family-privacy">
          <span>私</span>无需密码，仅家长可以管理账户与家庭资料
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
