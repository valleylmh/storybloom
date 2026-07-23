"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, CheckCircle, ImageSquare, MagicWand, Plus, SignOut, SpinnerGap, Trash, X } from "@phosphor-icons/react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Character = {
  id: string; display_name: string; relationship: string; kind: "person" | "pet";
  description: string | null; source_photo_path: string | null; canonical_photo_path: string | null;
  status: string; error_message: string | null; sort_order: number;
};
const RELATIONS = ["孩子", "爸爸", "妈妈", "爷爷", "奶奶", "外公", "外婆", "哥哥", "姐姐", "弟弟", "妹妹", "宠物"];
const STATUS_LABELS: Record<string, string> = { draft: "待上传照片", source_uploaded: "参考照已保存", processing: "正在生成设定稿", ready: "绘本形象已就绪", failed: "生成失败" };

async function cleanPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error("请选择 8MB 内的 JPG、PNG 或 WebP 图片");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("照片处理失败")), "image/webp", .88));
}

export default function FamilyLibrary() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string>();
  const [items, setItems] = useState<Character[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Character | "new" | null>(null);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState("");

  async function ensureProfile(userId: string) {
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
          guardian_consent_at: new Date().toISOString(),
          guardian_consent_version: "2026-07",
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
    const nextProfileId = await ensureProfile(userId);
    const { data, error } = await supabase.from("family_characters").select("*").eq("profile_id", nextProfileId).order("sort_order");
    if (error) throw error;
    const rows = (data || []) as Character[]; setItems(rows);
    const paths = rows.flatMap(x => [x.canonical_photo_path, x.source_photo_path]).filter(Boolean) as string[];
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("family-photos").createSignedUrls(paths, 3600);
      const next: Record<string, string> = {}; signed?.forEach((x, i) => { if (x.signedUrl) next[paths[i]] = x.signedUrl; }); setUrls(next);
    }
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) refresh(data.session.user.id).catch((error) => setNotice(error.message || "家庭资料加载失败")).finally(() => setLoading(false)); else setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, next) => { setSession(next); if (next) refresh(next.user.id).catch((error) => setNotice(error.message || "家庭资料加载失败")); });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy("login"); setNotice("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/family` } });
    setBusy(undefined); if (error) setNotice(error.message); else setSent(true);
  }
  async function save(form: { name: string; relation: string; description: string; file?: File }) {
    if (!session) throw new Error("登录状态已失效，请刷新页面后重新登录");
    setBusy("save"); setNotice("");
    try {
      const nextProfileId = profileId || await ensureProfile(session.user.id);
      const current = editing === "new" ? null : editing;
      const id = current?.id || crypto.randomUUID(); const kind = form.relation === "宠物" ? "pet" : "person";
      let source = current?.source_photo_path || null;
      if (form.file) {
        const blob = await cleanPhoto(form.file); source = `${session.user.id}/${id}/source.webp`;
        const { error } = await supabase.storage.from("family-photos").upload(source, blob, { contentType: "image/webp", upsert: true }); if (error) throw error;
      }
      const payload = { id, profile_id: nextProfileId, user_id: session.user.id, display_name: form.name.trim(), relationship: form.relation, kind, description: form.description.trim(), source_photo_path: source, status: source ? "source_uploaded" : "draft", sort_order: current?.sort_order ?? items.length };
      const { error } = await supabase.from("family_characters").upsert(payload); if (error) throw error;
      setEditing(null); await refresh(session.user.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存失败";
      setNotice(message);
      throw e instanceof Error ? e : new Error(message);
    } finally { setBusy(undefined); }
  }
  async function generate(id: string) { setBusy(id); setNotice(""); try { const r = await fetch(`/api/family/characters/${id}/generate`, { method: "POST", headers: { Authorization: `Bearer ${session?.access_token || ""}` } }); const body = await r.json(); if (!r.ok) throw new Error(body.error || "生成失败"); if (session) await refresh(session.user.id); } catch(e) { setNotice(e instanceof Error ? e.message : "生成失败"); } finally { setBusy(undefined); } }
  async function remove(item: Character) { if (!session || !confirm(`删除「${item.display_name}」？`)) return; setBusy(item.id); const paths=[item.source_photo_path,item.canonical_photo_path].filter(Boolean) as string[]; if(paths.length) await supabase.storage.from("family-photos").remove(paths); await supabase.from("family_characters").delete().eq("id", item.id); await refresh(session.user.id); setBusy(undefined); }

  if (loading) return <main className="family-page family-centered"><SpinnerGap className="spin" size={28}/></main>;
  if (!session) return <main className="family-page family-centered"><section className="family-login-shell"><div className="family-login"><Link href="/" className="family-back"><ArrowLeft/> 返回首页</Link><Link href="/" className="family-login-brand">StoryBloom<span>家庭角色库</span></Link><p className="family-kicker">PRIVATE FAMILY LIBRARY</p><h1>把最熟悉的人，<br/>写进每一页故事里</h1><p>保存一次家庭角色，以后只用一句话，就能让孩子和家人一起走进新的绘本冒险。</p>{sent ? <div className="family-mail-sent"><CheckCircle size={24}/><span>登录链接已发送至<br/><strong>{email}</strong></span><small>请打开邮件完成登录，此页面可以暂时保留。</small></div> : <form onSubmit={login}><label><span>家长邮箱</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label><button disabled={busy==="login"}>{busy==="login"?<SpinnerGap className="spin"/>:"发送登录链接"}</button></form>}{notice&&<p className="family-error">{notice}</p>}<small className="family-privacy"><span>私</span>仅家长可以管理资料，照片保存在私有空间</small></div><aside className="family-login-visual" aria-hidden="true"><div className="family-orbit family-orbit-one"/><div className="family-orbit family-orbit-two"/><div className="family-portrait family-portrait-child"><span>孩子</span></div><div className="family-portrait family-portrait-parent"><span>家人</span></div><div className="family-portrait family-portrait-pet"><span>宠物</span></div><div className="family-visual-copy"><p>一次创建，反复使用</p><strong>每个新故事，<br/>都有熟悉的人。</strong></div></aside></section></main>;
  return <main className="family-page"><header className="family-header"><Link href="/" className="family-brand">StoryBloom <span>家庭角色库</span></Link><button className="family-text-btn" onClick={()=>supabase.auth.signOut()}><SignOut/>退出</button></header><section className="family-hero"><p className="family-kicker">YOUR STORY, YOUR FAMILY</p><h1>我的家庭角色</h1><p>为家人建立一次形象，以后只用一句话，就能让他们一起走进新的冒险。</p><button className="family-primary" onClick={()=>setEditing("new")}><Plus/> 添加家庭成员</button></section>{notice&&<div className="family-notice">{notice}<button onClick={()=>setNotice("")}><X/></button></div>}<section className="family-grid">{items.map(item=>{const image=item.canonical_photo_path||item.source_photo_path; return <article className="family-card" key={item.id}><div className="family-photo">{image?<img src={urls[image]} alt={item.display_name}/>:<ImageSquare/>}<span className={`family-status ${item.status}`}>{STATUS_LABELS[item.status]||item.status}</span></div><div className="family-card-body"><p>{item.relationship}</p><h2>{item.display_name}</h2><div className="family-description">{item.description||"还没有补充角色特点"}</div>{item.error_message&&<small className="family-error">{item.error_message}</small>}<div className="family-actions"><button onClick={()=>setEditing(item)}>编辑</button>{item.source_photo_path&&!item.canonical_photo_path&&<button className="magic" disabled={busy===item.id} onClick={()=>generate(item.id)}>{busy===item.id?<SpinnerGap className="spin"/>:<MagicWand/>}生成绘本形象</button>}<button className="danger" onClick={()=>remove(item)} aria-label="删除"><Trash/></button></div></div></article>})}<button className="family-add-card" onClick={()=>setEditing("new")}><span><Plus/></span><strong>添加新角色</strong><small>孩子、父母、长辈或宠物</small></button></section>{editing&&<CharacterDialog character={editing} busy={busy==="save"} onClose={()=>setEditing(null)} onSave={save}/>}</main>;
}

function CharacterDialog({character,busy,onClose,onSave}:{character:Character|"new";busy:boolean;onClose:()=>void;onSave:(x:{name:string;relation:string;description:string;file?:File})=>Promise<void>}) {
  const existing=character==="new"?null:character; const [name,setName]=useState(existing?.display_name||""); const [relation,setRelation]=useState(existing?.relationship||"孩子"); const [description,setDescription]=useState(existing?.description||""); const [file,setFile]=useState<File>(); const [error,setError]=useState(""); const preview=file?URL.createObjectURL(file):null;
  async function submit(e: React.FormEvent) { e.preventDefault(); setError(""); try { await onSave({name,relation,description,file}); } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请稍后重试"); } }
  return <div className="family-modal" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}><form className="family-dialog" onSubmit={submit}><button type="button" className="family-close" disabled={busy} onClick={onClose}><X/></button><p className="family-kicker">FAMILY CHARACTER</p><h2>{existing?"编辑角色":"添加一位家人"}</h2><label className="family-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0])}/>{preview?<img src={preview} alt="照片预览"/>:<><Camera size={30}/><strong>上传清晰正面照</strong><small>可选 · JPG / PNG / WebP · 最大 8MB</small></>}</label><div className="family-fields"><label><span>称呼</span><input required maxLength={30} value={name} onChange={e=>setName(e.target.value)} placeholder="例如：小满"/></label><label><span>家庭关系</span><select value={relation} onChange={e=>setRelation(e.target.value)}>{RELATIONS.map(x=><option key={x}>{x}</option>)}</select></label><label className="wide"><span>角色特点（可选）</span><textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="卷卷的短发，喜欢黄色雨靴，勇敢又有一点害羞……"/></label></div><p className="family-consent">上传即表示你是照片中的本人或其监护人，并同意仅用于生成家庭绘本角色。</p>{error&&<p className="family-dialog-error" role="alert">{error}</p>}<button className="family-primary submit" disabled={busy}>{busy?<><SpinnerGap className="spin"/>正在保存</>:"保存角色"}</button></form></div>;
}
