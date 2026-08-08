"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  ImageSquare,
  MagicWand,
  Plus,
  SignOut,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { recordGuardianConsent } from "@/lib/auth/guardian-consent";

type Character = {
  id: string;
  display_name: string;
  relationship: string;
  kind: "person" | "pet";
  description: string | null;
  source_photo_path: string | null;
  canonical_photo_path: string | null;
  status: string;
  error_message: string | null;
  sort_order: number;
};

type CharacterForm = {
  name: string;
  relation: string;
  description: string;
  file?: File;
  guardianConsentConfirmed: boolean;
};

const RELATIONS = [
  "孩子",
  "爸爸",
  "妈妈",
  "爷爷",
  "奶奶",
  "外公",
  "外婆",
  "哥哥",
  "姐姐",
  "弟弟",
  "妹妹",
  "宠物",
];
const STATUS_LABELS: Record<string, string> = {
  draft: "待上传照片",
  source_uploaded: "参考照已保存",
  processing: "正在生成设定稿",
  ready: "绘本形象已就绪",
  failed: "生成失败",
};

async function cleanPhoto(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 8 * 1024 * 1024
  ) {
    throw new Error("请选择 8MB 内的 JPG、PNG 或 WebP 图片");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("照片处理失败"))),
      "image/webp",
      0.88,
    ),
  );
}

export default function FamilyLibrary({ embedded = false }: { embedded?: boolean }) {
  const { supabase, session, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string>();
  const [items, setItems] = useState<Character[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Character | "new" | null>(null);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState("");

  async function ensureProfile(userId: string) {
    if (!supabase) throw new Error("账户服务尚未准备好，请稍后再试");
    const existing = await supabase
      .from("family_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      setProfileId(existing.data.id);
      return existing.data.id;
    }

    const created = await supabase
      .from("family_profiles")
      .upsert(
        {
          user_id: userId,
          display_name: "我的家庭",
          locale: "zh-CN",
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (created.error) throw created.error;
    setProfileId(created.data.id);
    return created.data.id;
  }

  async function refresh(userId: string) {
    if (!supabase) throw new Error("账户服务尚未准备好，请稍后再试");
    const nextProfileId = await ensureProfile(userId);
    const { data, error } = await supabase
      .from("family_characters")
      .select("*")
      .eq("profile_id", nextProfileId)
      .order("sort_order");
    if (error) throw error;

    const rows = (data || []) as Character[];
    setItems(rows);
    const paths = rows
      .flatMap((item) => [item.canonical_photo_path, item.source_photo_path])
      .filter(Boolean) as string[];
    if (!paths.length) {
      setUrls({});
      return;
    }

    const { data: signed } = await supabase.storage
      .from("family-photos")
      .createSignedUrls(paths, 3600);
    const nextUrls: Record<string, string> = {};
    signed?.forEach((item, index) => {
      if (item.signedUrl) nextUrls[paths[index]] = item.signedUrl;
    });
    setUrls(nextUrls);
  }

  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;
    setLoading(true);
    setNotice("");
    void refresh(session.user.id)
      .catch((error) => {
        if (active) setNotice(error.message || "家庭资料加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id, supabase]);

  async function save(form: CharacterForm) {
    if (!supabase || !session) throw new Error("登录状态已失效，请刷新页面后重新登录");
    setBusy("save");
    setNotice("");
    try {
      const nextProfileId = profileId || (await ensureProfile(session.user.id));
      const current = editing === "new" ? null : editing;
      const id = current?.id || crypto.randomUUID();
      const kind = form.relation === "宠物" ? "pet" : "person";
      const uploadsPersonPhoto = Boolean(form.file) && kind === "person";
      if (uploadsPersonPhoto && !form.guardianConsentConfirmed) {
        throw new Error("上传人物照片前，请先确认你已获得本人或监护人的明确授权。");
      }

      let source = current?.source_photo_path || null;
      if (form.file) {
        const blob = await cleanPhoto(form.file);
        if (uploadsPersonPhoto) {
          await recordGuardianConsent(supabase, session.user.id);
        }
        source = `${session.user.id}/${id}/source.webp`;
        const { error } = await supabase.storage
          .from("family-photos")
          .upload(source, blob, { contentType: "image/webp", upsert: true });
        if (error) throw error;
      }

      const payload = {
        id,
        profile_id: nextProfileId,
        user_id: session.user.id,
        display_name: form.name.trim(),
        relationship: form.relation,
        kind,
        description: form.description.trim(),
        source_photo_path: source,
        status: source ? "source_uploaded" : "draft",
        sort_order: current?.sort_order ?? items.length,
      };
      const { error } = await supabase.from("family_characters").upsert(payload);
      if (error) throw error;
      setEditing(null);
      await refresh(session.user.id);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "保存失败";
      setNotice(message);
      throw cause instanceof Error ? cause : new Error(message);
    } finally {
      setBusy(undefined);
    }
  }

  async function generate(id: string) {
    setBusy(id);
    setNotice("");
    try {
      const response = await fetch(`/api/family/characters/${id}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "生成失败");
      if (session) await refresh(session.user.id);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setBusy(undefined);
    }
  }

  async function remove(item: Character) {
    if (!supabase || !session || !confirm(`删除「${item.display_name}」？`)) return;
    setBusy(item.id);
    setNotice("");
    try {
      const paths = [item.source_photo_path, item.canonical_photo_path].filter(
        Boolean,
      ) as string[];
      if (paths.length) await supabase.storage.from("family-photos").remove(paths);
      const { error } = await supabase
        .from("family_characters")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      await refresh(session.user.id);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setBusy(undefined);
    }
  }

  async function handleSignOut() {
    setNotice("");
    try {
      await signOut();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "退出失败");
    }
  }

  if (loading) {
    return (
      <main className={embedded ? "family-inline-loading" : "family-page family-centered"}>
        <SpinnerGap className="spin" size={28} />
      </main>
    );
  }

  return (
    <main className={`family-page ${embedded ? "family-page-embedded" : ""}`}>
      {!embedded ? (
        <header className="family-header">
          <Link href="/" className="family-brand">
            StoryBloom <span>家庭角色库</span>
          </Link>
          <button className="family-text-btn" onClick={() => void handleSignOut()}>
            <SignOut />退出
          </button>
        </header>
      ) : null}
      <section className="family-hero">
        <p className="family-kicker">YOUR STORY, YOUR FAMILY</p>
        <h1>家庭角色</h1>
        <p>为孩子、父母、长辈或宠物建立形象，以后只用一句话，就能让熟悉的家人走进新的绘本冒险。</p>
        <button className="family-primary" onClick={() => setEditing("new")}>
          <Plus /> 添加家庭成员
        </button>
      </section>
      {notice ? (
        <div className="family-notice">
          {notice}<button onClick={() => setNotice("")}><X /></button>
        </div>
      ) : null}
      <section className="family-grid">
        {items.map((item) => {
          const image = item.canonical_photo_path || item.source_photo_path;
          return (
            <article className="family-card" key={item.id}>
              <div className="family-photo">
                {image ? <img src={urls[image]} alt={item.display_name} /> : <ImageSquare />}
                <span className={`family-status ${item.status}`}>
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              </div>
              <div className="family-card-body">
                <p>{item.relationship}</p>
                <h2>{item.display_name}</h2>
                <div className="family-description">
                  {item.description || "还没有补充角色特点"}
                </div>
                {item.error_message ? (
                  <small className="family-error">{item.error_message}</small>
                ) : null}
                <div className="family-actions">
                  <button onClick={() => setEditing(item)}>编辑</button>
                  {item.source_photo_path && !item.canonical_photo_path ? (
                    <button
                      className="magic"
                      disabled={busy === item.id}
                      onClick={() => void generate(item.id)}
                    >
                      {busy === item.id ? <SpinnerGap className="spin" /> : <MagicWand />}
                      生成绘本形象
                    </button>
                  ) : null}
                  <button
                    className="danger"
                    onClick={() => void remove(item)}
                    aria-label="删除"
                  >
                    <Trash />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        <button className="family-add-card" onClick={() => setEditing("new")}>
          <span><Plus /></span>
          <strong>添加新角色</strong>
          <small>孩子、父母、长辈或宠物</small>
        </button>
      </section>
      {editing ? (
        <CharacterDialog
          character={editing}
          busy={busy === "save"}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}
    </main>
  );
}

function CharacterDialog({
  character,
  busy,
  onClose,
  onSave,
}: {
  character: Character | "new";
  busy: boolean;
  onClose: () => void;
  onSave: (form: CharacterForm) => Promise<void>;
}) {
  const existing = character === "new" ? null : character;
  const [name, setName] = useState(existing?.display_name || "");
  const [relation, setRelation] = useState(existing?.relationship || "孩子");
  const [description, setDescription] = useState(existing?.description || "");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [guardianConsentConfirmed, setGuardianConsentConfirmed] = useState(false);
  const [error, setError] = useState("");
  const needsGuardianConsent = Boolean(file) && relation !== "宠物";

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (needsGuardianConsent && !guardianConsentConfirmed) {
      setError("上传人物照片前，请勾选并确认你已获得本人或监护人的明确授权。");
      return;
    }
    try {
      await onSave({
        name,
        relation,
        description,
        file,
        guardianConsentConfirmed,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请稍后重试");
    }
  }

  return (
    <div
      className="family-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <form className="family-dialog" onSubmit={submit}>
        <button type="button" className="family-close" disabled={busy} onClick={onClose}>
          <X />
        </button>
        <p className="family-kicker">FAMILY CHARACTER</p>
        <h2>{existing ? "编辑角色" : "添加一位家人"}</h2>
        <label className="family-upload">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setGuardianConsentConfirmed(false);
            }}
          />
          {preview ? (
            <img src={preview} alt="照片预览" />
          ) : (
            <>
              <Camera size={30} />
              <strong>上传清晰正面照</strong>
              <small>可选 · JPG / PNG / WebP · 最大 8MB</small>
            </>
          )}
        </label>
        <div className="family-fields">
          <label>
            <span>称呼</span>
            <input
              required
              maxLength={30}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：小满"
            />
          </label>
          <label>
            <span>家庭关系</span>
            <select value={relation} onChange={(event) => setRelation(event.target.value)}>
              {RELATIONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="wide">
            <span>角色特点（可选）</span>
            <textarea
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="卷卷的短发，喜欢黄色雨靴，勇敢又有一点害羞……"
            />
          </label>
        </div>
        {needsGuardianConsent ? (
          <label className="family-consent-check">
            <input
              type="checkbox"
              checked={guardianConsentConfirmed}
              onChange={(event) => setGuardianConsentConfirmed(event.target.checked)}
            />
            <span>
              我确认自己是照片中的本人或其监护人，已获得明确授权，并同意将照片用于生成私密家庭绘本角色。
            </span>
          </label>
        ) : (
          <p className="family-consent">人物照片仅在明确授权后上传至家庭私有空间。</p>
        )}
        {error ? <p className="family-dialog-error" role="alert">{error}</p> : null}
        <button
          className="family-primary submit"
          disabled={busy || (needsGuardianConsent && !guardianConsentConfirmed)}
        >
          {busy ? <><SpinnerGap className="spin" />正在保存</> : "保存角色"}
        </button>
      </form>
    </div>
  );
}
