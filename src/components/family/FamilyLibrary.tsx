"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Crop,
  ImageSquare,
  MagicWand,
  Microphone,
  PencilSimple,
  Plus,
  SignOut,
  SpeakerSlash,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { recordGuardianConsent } from "@/lib/auth/guardian-consent";
import CharacterImageCropDialog, {
  getFamilyImageCropStyle,
} from "@/components/family/CharacterImageCropDialog";
import FamilyVoiceDialog, {
  type FamilyVoiceRecording,
} from "@/components/family/FamilyVoiceDialog";
import {
  MAX_FAMILY_CHARACTER_GENERATIONS,
  getRemainingFamilyCharacterGenerations,
  normalizeFamilyCharacterGenerationCount,
} from "@/lib/family-character-generation";
import {
  DEFAULT_FAMILY_IMAGE_CROP,
  normalizeFamilyImageCrop,
  type FamilyImageCrop,
} from "@/lib/family-image-crop";
import {
  dedupeFamilyCharacters,
  findReusableFamilyCharacter,
} from "@/lib/family-character-dedupe";
import {
  createFamilyPhotoUrls,
  deleteFamilyCharacter,
  ensureFamilyProfile,
  listFamilyCharacters,
  removeFamilyPhotos,
  updateFamilyCharacter,
  uploadFamilyPhoto,
  upsertFamilyCharacter,
} from "@/lib/repositories/family-character-repository";
import {
  listFamilyCharacterVoices,
  removeFamilyVoiceSamples,
  uploadFamilyVoiceSample,
  type FamilyCharacterVoiceSafeRow,
} from "@/lib/repositories/family-character-voice-repository";
import {
  getFamilyVoiceCanonicalExtension,
  isFamilyVoiceProcessingStale,
  normalizeFamilyVoiceContentType,
} from "@/lib/family-voice";
import {
  forgetPendingFamilyVoiceUpload,
  reconcilePendingFamilyVoiceUploads,
  rememberPendingFamilyVoiceUpload,
} from "@/lib/family-voice-pending-upload";

type Character = {
  id: string;
  display_name: string;
  relationship: string;
  kind: "person" | "pet";
  description: string | null;
  source_photo_path: string | null;
  canonical_photo_path: string | null;
  source_crop: FamilyImageCrop | null;
  canonical_crop: FamilyImageCrop | null;
  cartoonize: boolean;
  canonical_generation_count: number;
  status: string;
  error_message: string | null;
  sort_order: number;
};

type CharacterForm = {
  name: string;
  relation: string;
  description: string;
  file?: File;
  cartoonize: boolean;
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
  processing: "正在生成卡通形象",
  ready: "卡通形象已就绪",
  failed: "生成失败",
};

type CharacterImageSelection = {
  path: string;
  crop: unknown;
  field: "source_crop" | "canonical_crop";
  label: "真实照片" | "卡通形象";
};

function getCharacterImageSelection(character: Character): CharacterImageSelection | null {
  if (character.cartoonize !== false && character.canonical_photo_path) {
    return {
      path: character.canonical_photo_path,
      crop: character.canonical_crop,
      field: "canonical_crop",
      label: "卡通形象",
    };
  }
  if (character.source_photo_path) {
    return {
      path: character.source_photo_path,
      crop: character.source_crop,
      field: "source_crop",
      label: "真实照片",
    };
  }
  if (character.canonical_photo_path) {
    return {
      path: character.canonical_photo_path,
      crop: character.canonical_crop,
      field: "canonical_crop",
      label: "卡通形象",
    };
  }
  return null;
}

function getCharacterStatusLabel(character: Character) {
  if (character.source_photo_path && character.cartoonize === false) {
    return "真实照片已保存";
  }
  return STATUS_LABELS[character.status] || character.status;
}

function getFamilyVoiceReconciliationStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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
  const [voicesByCharacterId, setVoicesByCharacterId] = useState<
    Record<string, FamilyCharacterVoiceSafeRow>
  >({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Character | "new" | null>(null);
  const [cropping, setCropping] = useState<{
    character: Character;
    image: CharacterImageSelection;
  } | null>(null);
  const [voiceCharacter, setVoiceCharacter] = useState<Character | null>(null);
  const [busy, setBusy] = useState<string>();
  const [voiceBusy, setVoiceBusy] = useState<string>();
  const [notice, setNotice] = useState("");

  async function ensureProfile(userId: string) {
    if (!supabase) throw new Error("账户服务尚未准备好，请稍后再试");
    const nextProfileId = await ensureFamilyProfile(supabase, userId);
    setProfileId(nextProfileId);
    return nextProfileId;
  }

  async function refresh(userId: string) {
    if (!supabase) throw new Error("账户服务尚未准备好，请稍后再试");
    const nextProfileId = await ensureProfile(userId);
    const [characterRows, voiceRows] = await Promise.all([
      listFamilyCharacters<Character>(supabase, { profileId: nextProfileId }),
      listFamilyCharacterVoices(supabase, { profileId: nextProfileId }),
    ]);
    const rows = dedupeFamilyCharacters(characterRows);
    setItems(rows);
    setVoicesByCharacterId(
      Object.fromEntries(
        voiceRows.map((voice) => [voice.family_character_id, voice]),
      ),
    );
    const reconciliationStorage = getFamilyVoiceReconciliationStorage();
    if (reconciliationStorage) {
      void reconcilePendingFamilyVoiceUploads(
        supabase,
        reconciliationStorage,
        userId,
        voiceRows,
      );
    }
    const paths = rows
      .flatMap((item) => [item.canonical_photo_path, item.source_photo_path])
      .filter(Boolean) as string[];
    if (!paths.length) {
      setUrls({});
      return;
    }

    setUrls(await createFamilyPhotoUrls(supabase, paths));
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

  const hasProcessingVoices = Object.values(voicesByCharacterId).some(
    (voice) => voice.status === "processing",
  );
  const voiceMaintenanceCharacterIds = Object.values(voicesByCharacterId)
    .filter((voice) => voice.status !== "deleting")
    .map((voice) => voice.family_character_id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!supabase || !session || !profileId || !voiceMaintenanceCharacterIds) {
      return;
    }
    let active = true;
    let polling = false;
    const controller = new AbortController();
    const pollVoices = async () => {
      if (polling) return;
      polling = true;
      try {
        const characterIds = voiceMaintenanceCharacterIds
          ? voiceMaintenanceCharacterIds.split(",")
          : [];
        await Promise.allSettled(
          characterIds.map(async (characterId) => {
            const response = await fetch(
              `/api/family/characters/${characterId}/voice`,
              {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
                signal: controller.signal,
              },
            );
            if (!response.ok) {
              throw new Error("family-voice-status-refresh-failed");
            }
          }),
        );
        if (!active) return;

        const voiceRows = await listFamilyCharacterVoices(supabase, {
          userId: session.user.id,
          profileId,
        });
        if (!active) return;
        setVoicesByCharacterId(
          Object.fromEntries(
            voiceRows.map((voice) => [voice.family_character_id, voice]),
          ),
        );
      } finally {
        polling = false;
      }
    };
    const runPoll = () => {
      void pollVoices().catch(() => {
        // Polling is best effort; the main page notice remains reserved for user actions.
      });
    };
    runPoll();
    const timer = window.setInterval(
      runPoll,
      hasProcessingVoices ? 10_000 : 60_000,
    );
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [
    hasProcessingVoices,
    voiceMaintenanceCharacterIds,
    profileId,
    session?.access_token,
    session?.user.id,
    supabase,
  ]);

  useEffect(() => {
    if (!supabase || !session || !profileId) return;
    const timer = window.setInterval(() => {
      void listFamilyCharacterVoices(supabase, {
        userId: session.user.id,
        profileId,
      })
        .then((voiceRows) => {
          const reconciliationStorage =
            getFamilyVoiceReconciliationStorage();
          if (!reconciliationStorage) return;
          return reconcilePendingFamilyVoiceUploads(
            supabase,
            reconciliationStorage,
            session.user.id,
            voiceRows,
          );
        })
        .catch(() => {
          // A later refresh can retry private upload reconciliation.
        });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [profileId, session?.user.id, supabase]);

  async function save(form: CharacterForm) {
    if (!supabase || !session) throw new Error("登录状态已失效，请刷新页面后重新登录");
    setBusy("save");
    setNotice("");
    let autoGenerateId: string | undefined;
    try {
      const nextProfileId = profileId || (await ensureProfile(session.user.id));
      const current =
        editing === "new"
          ? findReusableFamilyCharacter(items, form.name, form.relation) || null
          : editing;
      const id = current?.id || crypto.randomUUID();
      const kind = form.relation === "宠物" ? "pet" : "person";
      if (
        current?.kind === "person" &&
        kind === "pet" &&
        voicesByCharacterId[current.id]
      ) {
        throw new Error(
          "这个人物已绑定真人声音，不能直接改为宠物。请先删除真人声音后再保存。",
        );
      }
      const currentGenerationCount = normalizeFamilyCharacterGenerationCount(
        current?.canonical_generation_count,
      );
      const needsNewCanonical = Boolean(
        form.cartoonize &&
        (form.file || current?.source_photo_path) &&
        (form.file || !current?.canonical_photo_path),
      );
      if (
        needsNewCanonical &&
        currentGenerationCount >= MAX_FAMILY_CHARACTER_GENERATIONS
      ) {
        throw new Error("这个角色已经用完 5 次卡通形象生成机会，请关闭卡通化后保存真实照片。");
      }
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
        await uploadFamilyPhoto(supabase, source, blob);
      }

      const canonical = form.file ? null : current?.canonical_photo_path || null;
      const status = source
        ? form.cartoonize
          ? canonical
            ? "ready"
            : "source_uploaded"
          : "ready"
        : "draft";

      const payload = {
        id,
        profile_id: nextProfileId,
        user_id: session.user.id,
        display_name: form.name.trim(),
        relationship: form.relation,
        kind,
        description: form.description.trim(),
        source_photo_path: source,
        canonical_photo_path: canonical,
        source_crop: form.file
          ? DEFAULT_FAMILY_IMAGE_CROP
          : normalizeFamilyImageCrop(current?.source_crop),
        canonical_crop: form.file
          ? DEFAULT_FAMILY_IMAGE_CROP
          : normalizeFamilyImageCrop(current?.canonical_crop),
        cartoonize: form.cartoonize,
        status,
        sort_order: current?.sort_order ?? items.length,
      };
      await upsertFamilyCharacter(supabase, payload);
      if (form.file && current?.canonical_photo_path) {
        await removeFamilyPhotos(supabase, [current.canonical_photo_path]);
      }
      setEditing(null);
      await refresh(session.user.id);
      const newlyEnabledCartoonization =
        current?.cartoonize === false && form.cartoonize;
      if (
        form.cartoonize &&
        source &&
        !canonical &&
        currentGenerationCount < MAX_FAMILY_CHARACTER_GENERATIONS &&
        (Boolean(form.file) || newlyEnabledCartoonization)
      ) {
        autoGenerateId = id;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "保存失败";
      setNotice(message);
      throw cause instanceof Error ? cause : new Error(message);
    } finally {
      setBusy(undefined);
    }
    if (autoGenerateId) {
      void generate(autoGenerateId);
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
      if (session) await refresh(session.user.id);
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
      const voiceSamplePath = voicesByCharacterId[item.id]?.sample_audio_path;
      if (voicesByCharacterId[item.id]) {
        await requestVoiceDeletion(item.id);
        if (voiceSamplePath) {
          const reconciliationStorage = getFamilyVoiceReconciliationStorage();
          if (reconciliationStorage) {
            forgetPendingFamilyVoiceUpload(
              reconciliationStorage,
              session.user.id,
              voiceSamplePath,
            );
          }
        }
      }
      await removeFamilyPhotos(supabase, paths);
      await deleteFamilyCharacter(supabase, session.user.id, item.id);
      await refresh(session.user.id);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setBusy(undefined);
    }
  }

  async function requestVoiceDeletion(characterId: string) {
    if (!session) throw new Error("登录状态已失效，请刷新页面后重新登录");
    const response = await fetch(`/api/family/characters/${characterId}/voice`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const body = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; pending?: boolean }
      | null;
    if (!response.ok) {
      throw new Error(body?.error || "真人声音删除失败，请稍后重试。");
    }
    if (response.status === 202 || body?.pending) {
      throw new Error(
        body?.message || "正在确认云端音色状态，请稍后继续删除。",
      );
    }
  }

  async function removeVoice(item: Character) {
    if (
      !supabase ||
      !session ||
      !confirm(
        `删除「${item.display_name}」的真人声音？这会删除私有录音，并请求阿里云百炼撤销克隆音色。`,
      )
    ) {
      return;
    }
    const voice = voicesByCharacterId[item.id];
    setVoiceBusy(item.id);
    setNotice("");
    try {
      await requestVoiceDeletion(item.id);
      if (voice?.sample_audio_path) {
        const reconciliationStorage = getFamilyVoiceReconciliationStorage();
        if (reconciliationStorage) {
          forgetPendingFamilyVoiceUpload(
            reconciliationStorage,
            session.user.id,
            voice.sample_audio_path,
          );
        }
      }
      await refresh(session.user.id);
      setNotice(`「${item.display_name}」的真人声音已删除。`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "真人声音删除失败");
      try {
        await refresh(session.user.id);
      } catch {
        // Preserve the deletion error as the actionable notice.
      }
    } finally {
      setVoiceBusy(undefined);
    }
  }

  async function createVoice(recording: FamilyVoiceRecording) {
    if (!supabase || !session || !voiceCharacter) {
      throw new Error("登录状态已失效，请刷新页面后重新登录");
    }
    const character = voiceCharacter;
    const contentType = normalizeFamilyVoiceContentType(recording.contentType);
    if (!contentType) {
      throw new Error("当前浏览器生成的录音格式不受支持，请更换浏览器后重试。");
    }
    const extension = getFamilyVoiceCanonicalExtension(contentType);
    const sampleAudioPath = `${session.user.id}/${character.id}/${crypto.randomUUID()}.${extension}`;
    const normalizedBlob = recording.blob.slice(
      0,
      recording.blob.size,
      contentType,
    );

    setVoiceBusy(character.id);
    setNotice("");
    try {
      await uploadFamilyVoiceSample(supabase, sampleAudioPath, normalizedBlob, {
        contentType,
      });
      const reconciliationStorage = getFamilyVoiceReconciliationStorage();
      if (reconciliationStorage) {
        rememberPendingFamilyVoiceUpload(
          reconciliationStorage,
          session.user.id,
          sampleAudioPath,
        );
      }
      let response: Response;
      try {
        response = await fetch(`/api/family/characters/${character.id}/voice`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sampleAudioPath,
            sampleDurationSeconds: Number(recording.durationSeconds.toFixed(3)),
            consentConfirmed: true,
          }),
        });
      } catch {
        throw new Error(
          "网络响应中断，声音可能仍在创建。请先关闭窗口并等待状态刷新，避免重复提交。",
        );
      }
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            cleanupSample?: boolean;
            status?: "processing" | "ready";
          }
        | null;
      if (!response.ok) {
        if (body?.cleanupSample === true) {
          try {
            await removeFamilyVoiceSamples(supabase, [sampleAudioPath]);
            if (reconciliationStorage) {
              forgetPendingFamilyVoiceUpload(
                reconciliationStorage,
                session.user.id,
                sampleAudioPath,
              );
            }
          } catch {
            // Cleanup is best effort; never mask the explicit API failure.
          }
        }
        try {
          await refresh(session.user.id);
        } catch {
          // The enrollment error below is the actionable result for this dialog.
        }
        throw new Error(body?.error || "声音创建失败，请稍后重试。");
      }

      const isStillProcessing =
        response.status === 202 || body?.status === "processing";
      if (reconciliationStorage) {
        forgetPendingFamilyVoiceUpload(
          reconciliationStorage,
          session.user.id,
          sampleAudioPath,
        );
      }

      let refreshFailed = false;
      try {
        await refresh(session.user.id);
      } catch {
        refreshFailed = true;
      }
      setVoiceCharacter(null);
      setNotice(
        isStillProcessing
          ? refreshFailed
            ? `「${character.display_name}」的真人声音已提交，正在审核中。角色状态暂未刷新，请稍后重新打开页面查看。`
            : `「${character.display_name}」的真人声音已提交，正在审核中。审核通过后会自动用于这个角色的绘本视频旁白。`
          : refreshFailed
            ? `「${character.display_name}」的真人声音已创建。角色状态暂未刷新，请重新打开页面查看。`
            : `「${character.display_name}」的真人声音已创建，将用于这个角色的绘本视频旁白。`,
      );
    } finally {
      setVoiceBusy(undefined);
    }
  }

  async function saveCrop(crop: FamilyImageCrop) {
    if (!supabase || !session || !cropping) {
      throw new Error("裁剪状态已失效，请重新打开后再试");
    }
    const characterId = cropping.character.id;
    setBusy(characterId);
    setNotice("");
    try {
      await updateFamilyCharacter(supabase, session.user.id, characterId, {
        [cropping.image.field]: normalizeFamilyImageCrop(crop),
      });
      setCropping(null);
      await refresh(session.user.id);
    } catch (cause) {
      throw cause instanceof Error ? cause : new Error("裁剪保存失败");
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
        <p>为孩子、父母、长辈或宠物建立形象，也可在明确授权后为人物创建私密真人声音，让熟悉的家人走进新的绘本冒险。</p>
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
          const imageSelection = getCharacterImageSelection(item);
          const image = imageSelection?.path;
          const generationCount = normalizeFamilyCharacterGenerationCount(
            item.canonical_generation_count,
          );
          const remainingGenerations = getRemainingFamilyCharacterGenerations(
            generationCount,
          );
          const voice = voicesByCharacterId[item.id];
          const voiceProcessingStale =
            voice?.status === "processing" &&
            isFamilyVoiceProcessingStale(voice.updated_at);
          const canGenerateCartoon =
            Boolean(item.source_photo_path) && item.cartoonize !== false;
          return (
            <article className="family-card" key={item.id}>
              <div className="family-photo">
                {image ? (
                  <img
                    src={urls[image]}
                    alt={item.display_name}
                    style={getFamilyImageCropStyle(imageSelection?.crop)}
                  />
                ) : <ImageSquare />}
                <span className={`family-status ${item.status}`}>
                  {getCharacterStatusLabel(item)}
                </span>
                <div className="family-photo-actions">
                  {imageSelection ? (
                    <button
                      type="button"
                      className="family-photo-action"
                      onClick={() => setCropping({ character: item, image: imageSelection })}
                      aria-label={`裁剪${item.display_name}的${imageSelection.label}`}
                      title={`裁剪${imageSelection.label}`}
                      disabled={busy === item.id || !urls[imageSelection.path]}
                    >
                      <Crop size={17} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="family-photo-action"
                    onClick={() => setEditing(item)}
                    aria-label={`编辑${item.display_name}`}
                    title="编辑角色"
                    disabled={busy === item.id}
                  >
                    <PencilSimple size={17} />
                  </button>
                  <button
                    type="button"
                    className="family-photo-action family-photo-delete"
                    onClick={() => void remove(item)}
                    aria-label={`删除${item.display_name}`}
                    title="删除角色"
                    disabled={busy === item.id}
                  >
                    <Trash size={17} />
                  </button>
                </div>
              </div>
              <div className="family-card-body">
                <p>{item.relationship}</p>
                <h2>{item.display_name}</h2>
                <div className="family-description">
                  {item.description || "还没有补充角色特点"}
                </div>
                {item.source_photo_path ? (
                  <small className="family-generation-meta">
                    {item.cartoonize === false
                      ? "保留真实照片"
                      : `卡通化生成 ${generationCount}/${MAX_FAMILY_CHARACTER_GENERATIONS} 次`}
                  </small>
                ) : null}
                {item.error_message ? (
                  <small className="family-error">{item.error_message}</small>
                ) : null}
                {voice ? (
                  <small className={`family-voice-meta ${voice.status}`}>
                    {voice.status === "processing" ? (
                      <SpinnerGap size={15} />
                    ) : (
                      <Microphone size={15} />
                    )}
                    {voice.status === "ready"
                      ? "真人声音已就绪"
                      : voice.status === "deleting"
                        ? "真人声音正在删除或等待重试"
                      : voice.status === "processing"
                        ? voiceProcessingStale
                          ? "声音创建已超时，可重新录制"
                          : "真人声音审核中"
                        : voice.error_message || "真人声音创建失败"}
                  </small>
                ) : null}
                {canGenerateCartoon || item.kind === "person" || voice ? (
                  <div className="family-actions">
                    {canGenerateCartoon ? (
                      <button
                        className="magic"
                        disabled={
                          busy === item.id ||
                          item.status === "processing" ||
                          remainingGenerations === 0
                        }
                        onClick={() => void generate(item.id)}
                      >
                        {busy === item.id ? <SpinnerGap className="spin" /> : <MagicWand />}
                        {remainingGenerations === 0
                          ? "已达 5 次上限"
                          : item.canonical_photo_path
                            ? `重新生成 · 剩 ${remainingGenerations} 次`
                            : `生成卡通形象 · 剩 ${remainingGenerations} 次`}
                      </button>
                    ) : null}
                    {item.kind === "person" ? (
                      <button
                        type="button"
                        className="voice"
                        disabled={
                          busy === item.id ||
                          voiceBusy === item.id ||
                          voice?.status === "deleting" ||
                          (voice?.status === "processing" &&
                            !voiceProcessingStale)
                        }
                        onClick={() => setVoiceCharacter(item)}
                      >
                        {voiceBusy === item.id ||
                        (voice?.status === "processing" &&
                          !voiceProcessingStale) ? (
                          <SpinnerGap className="spin" />
                        ) : (
                          <Microphone />
                        )}
                        {voice?.status === "ready"
                          ? "重新录制声音"
                          : voice?.status === "deleting"
                            ? "声音正在删除"
                          : voice?.status === "failed"
                            ? "重新创建声音"
                            : voice?.status === "processing"
                              ? voiceProcessingStale
                                ? "重新录制声音"
                                : "声音审核中"
                              : "创建声音"}
                      </button>
                    ) : null}
                    {voice ? (
                      <button
                        type="button"
                        className="voice family-voice-delete"
                        disabled={
                          busy === item.id || voiceBusy === item.id
                        }
                        onClick={() => void removeVoice(item)}
                      >
                        {voiceBusy === item.id ? (
                          <SpinnerGap className="spin" />
                        ) : (
                          <SpeakerSlash />
                        )}
                        {voice.status === "deleting"
                          ? "继续删除声音"
                          : "删除真人声音"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
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
      {cropping && urls[cropping.image.path] ? (
        <CharacterImageCropDialog
          imageUrl={urls[cropping.image.path]}
          imageName={`${cropping.character.display_name}的${cropping.image.label}`}
          initialCrop={cropping.image.crop}
          busy={busy === cropping.character.id}
          onClose={() => setCropping(null)}
          onSave={saveCrop}
        />
      ) : null}
      {voiceCharacter ? (
        <FamilyVoiceDialog
          characterName={voiceCharacter.display_name}
          busy={voiceBusy === voiceCharacter.id}
          hasExistingVoice={
            voicesByCharacterId[voiceCharacter.id]?.status === "ready"
          }
          onClose={() => setVoiceCharacter(null)}
          onCreate={createVoice}
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
  const [cartoonize, setCartoonize] = useState(existing?.cartoonize ?? true);
  const [guardianConsentConfirmed, setGuardianConsentConfirmed] = useState(false);
  const [error, setError] = useState("");
  const needsGuardianConsent = Boolean(file) && relation !== "宠物";
  const hasPhoto = Boolean(file || existing?.source_photo_path);
  const remainingGenerations = getRemainingFamilyCharacterGenerations(
    existing?.canonical_generation_count,
  );
  const needsNewCanonical = Boolean(
    hasPhoto && cartoonize && (file || !existing?.canonical_photo_path),
  );
  const cartoonLimitReached = needsNewCanonical && remainingGenerations === 0;
  const willGenerateCartoon = Boolean(
    needsNewCanonical && remainingGenerations > 0,
  );

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
    if (cartoonLimitReached) {
      setError("这个角色已经用完 5 次卡通形象生成机会，请关闭卡通化后保存真实照片。");
      return;
    }
    try {
      await onSave({
        name,
        relation,
        description,
        file,
        cartoonize,
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
        {hasPhoto ? (
          <label className="family-cartoon-option">
            <input
              type="checkbox"
              checked={cartoonize}
              onChange={(event) => setCartoonize(event.target.checked)}
            />
            <span>
              <strong>
                {relation === "宠物"
                  ? "生成卡通拟人形象"
                  : "生成卡通绘本形象"}
              </strong>
              <small>
                使用 CPA Nano Banana 图生图模型保留外貌特征；每个家庭角色最多生成 5 次。
                {existing
                  ? ` 已使用 ${normalizeFamilyCharacterGenerationCount(existing.canonical_generation_count)}/${MAX_FAMILY_CHARACTER_GENERATIONS} 次。`
                  : ""}
              </small>
            </span>
          </label>
        ) : null}
        {cartoonLimitReached ? (
          <p className="family-dialog-error" role="status">
            已用完 5 次生成机会。关闭卡通化后，仍可保存并使用真实照片。
          </p>
        ) : null}
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
          disabled={
            busy ||
            cartoonLimitReached ||
            (needsGuardianConsent && !guardianConsentConfirmed)
          }
        >
          {busy ? (
            <><SpinnerGap className="spin" />正在保存</>
          ) : willGenerateCartoon ? (
            "保存并生成卡通形象"
          ) : (
            "保存角色"
          )}
        </button>
      </form>
    </div>
  );
}
