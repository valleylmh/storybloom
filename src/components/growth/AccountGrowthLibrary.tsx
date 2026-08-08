"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsClockwise,
  BookOpenText,
  Cloud,
  DeviceMobile,
  Plus,
  ShieldCheck,
  SignIn,
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { buildLoginPath } from "@/lib/auth/return-to";
import {
  groupGrowthRecordsByChild,
  type GrowthRecord,
} from "@/lib/growth-records";
import { createCloudGrowthRepository } from "@/lib/repositories/cloud-growth-repository";
import { localGrowthRepository } from "@/lib/repositories/local-growth-repository";
import {
  buildGrowthChildHref,
  chooseInitialGrowthSource,
  type GrowthDataSource,
} from "./growth-source-model";
import styles from "./GrowthArchive.module.css";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function AccountGrowthLibrary({
  requestedSource,
}: {
  requestedSource?: GrowthDataSource;
}) {
  const router = useRouter();
  const { supabase, session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const [source, setSource] = useState<GrowthDataSource>(
    requestedSource || "local",
  );
  const [localRecords, setLocalRecords] = useState<GrowthRecord[]>([]);
  const [cloudRecords, setCloudRecords] = useState<GrowthRecord[]>([]);
  const [cloudOwnerId, setCloudOwnerId] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [cloudError, setCloudError] = useState("");
  const requestIdRef = useRef(0);
  const sourceChosenRef = useRef(Boolean(requestedSource));

  const selectSource = useCallback(
    (nextSource: GrowthDataSource) => {
      sourceChosenRef.current = true;
      setSource(nextSource);
      router.replace(
        nextSource === "cloud" ? "/me/growth?source=cloud" : "/me/growth",
        { scroll: false },
      );
    },
    [router],
  );

  const loadRecords = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLocalLoading(true);
    setCloudLoading(Boolean(userId));
    setLocalError("");
    setCloudError("");
    setCloudRecords([]);
    setCloudOwnerId(null);

    const localTask = localGrowthRepository.list();
    const cloudTask =
      userId && supabase
        ? createCloudGrowthRepository(supabase, userId).list()
        : Promise.resolve([] as GrowthRecord[]);
    const [localResult, cloudResult] = await Promise.allSettled([
      localTask,
      cloudTask,
    ]);
    if (requestIdRef.current !== requestId) return;

    const nextLocalRecords =
      localResult.status === "fulfilled" ? localResult.value : [];
    const nextCloudRecords =
      cloudResult.status === "fulfilled" ? cloudResult.value : [];

    if (localResult.status === "fulfilled") {
      setLocalRecords(nextLocalRecords);
    } else {
      setLocalError("当前设备的成长记录暂时读取失败，请刷新后重试。");
    }
    setLocalLoading(false);

    if (userId) {
      if (cloudResult.status === "fulfilled") {
        setCloudRecords(nextCloudRecords);
        setCloudOwnerId(userId);
      } else {
        setCloudError("私有云端暂时读取失败；当前设备里的记录不受影响。");
      }
    }
    setCloudLoading(false);

    if (!sourceChosenRef.current) {
      const nextSource = chooseInitialGrowthSource({
        requested: requestedSource,
        localCount: nextLocalRecords.length,
        cloudCount: nextCloudRecords.length,
        signedIn: Boolean(userId),
      });
      setSource(nextSource);
      sourceChosenRef.current = true;
      if (nextSource === "cloud") {
        router.replace("/me/growth?source=cloud", { scroll: false });
      }
    }
  }, [requestedSource, router, supabase, userId]);

  useEffect(() => {
    if (authLoading) return;
    const refresh = () => void loadRecords();
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      requestIdRef.current += 1;
      window.removeEventListener("focus", refresh);
    };
  }, [authLoading, loadRecords]);

  const visibleCloudRecords =
    userId && cloudOwnerId === userId ? cloudRecords : [];
  const activeRecords = source === "cloud" ? visibleCloudRecords : localRecords;
  const activeLoading = source === "cloud" ? cloudLoading : localLoading;
  const activeError = source === "cloud" ? cloudError : localError;
  const children = useMemo(
    () => groupGrowthRecordsByChild(activeRecords),
    [activeRecords],
  );

  return (
    <main className={styles.embeddedPage}>
      <section className={styles.sourceOverview}>
        <div>
          <p className={styles.kicker}>DEVICE + PRIVATE CLOUD</p>
          <h1>成长记录保存在哪里，一目了然</h1>
          <span>当前设备与私有云端是两份独立副本；登录和查看都不会自动上传本地内容。</span>
        </div>
        <button
          type="button"
          className={styles.sourceRefresh}
          disabled={localLoading || cloudLoading}
          onClick={() => void loadRecords()}
        >
          <ArrowsClockwise /> 刷新
        </button>
      </section>

      <div className={styles.sourceTabs} role="tablist" aria-label="成长记录来源">
        <button
          type="button"
          role="tab"
          aria-selected={source === "local"}
          className={source === "local" ? styles.sourceTabActive : ""}
          onClick={() => selectSource("local")}
        >
          <DeviceMobile />
          <span>
            <strong>当前设备</strong>
            <small>退出登录后仍保留</small>
          </span>
          <b>{localLoading ? "…" : localRecords.length}</b>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === "cloud"}
          className={source === "cloud" ? styles.sourceTabActive : ""}
          onClick={() => selectSource("cloud")}
        >
          <Cloud />
          <span>
            <strong>私有云端</strong>
            <small>{userId ? "其他设备登录后可见" : "登录后查看"}</small>
          </span>
          <b>{authLoading || cloudLoading ? "…" : userId ? visibleCloudRecords.length : "—"}</b>
        </button>
      </div>

      <div className={styles.embeddedShell} role="tabpanel">
        <section className={styles.libraryHero}>
          <div>
            <p className={styles.kicker}>
              {source === "cloud" ? "PRIVATE CLOUD SHELF" : "DEVICE GROWTH SHELF"}
            </p>
            <h1>{source === "cloud" ? "私有云端成长故事" : "当前设备的成长故事"}</h1>
            <p>
              {source === "cloud"
                ? "这里只显示你主动导入的成长记录、照片和关联绘本。"
                : "把真实发生的小事、家长备注、现场照片和专属绘本留在一起。"}
            </p>
          </div>
          <span className={styles.privacyLabel}>
            {source === "cloud" ? <Cloud /> : <ShieldCheck />}
            {source === "cloud" ? "账户私有 · 跨设备可见" : "仅保存在当前浏览器"}
          </span>
        </section>

        {source === "local" && cloudError ? (
          <p className={styles.inactiveSourceNotice} role="status">
            私有云端暂时无法读取；当前设备内容仍可正常查看。
          </p>
        ) : null}
        {source === "cloud" && localError ? (
          <p className={styles.inactiveSourceNotice} role="status">
            当前设备记录暂时无法读取；私有云端内容仍可继续查看。
          </p>
        ) : null}

        {activeError ? (
          <section className={styles.sourceError} role="status">
            <p>{activeError}</p>
            <button type="button" onClick={() => void loadRecords()}>
              重新读取
            </button>
          </section>
        ) : activeLoading ? (
          <section className={styles.loadingState} aria-label="正在加载成长记录">
            <span />
            <span />
          </section>
        ) : source === "cloud" && !userId ? (
          <section className={styles.emptyState}>
            <Cloud />
            <h2>登录后查看私有云端</h2>
            <p>退出登录不会删除当前设备中的成长记录。</p>
            <Link href={buildLoginPath("/me/growth?source=cloud")}>
              <SignIn /> 登录账户
            </Link>
          </section>
        ) : children.length === 0 ? (
          <section className={styles.emptyState}>
            <BookOpenText />
            <h2>{source === "cloud" ? "云端还没有成长记录" : "当前设备还没有成长记录"}</h2>
            <p>
              {source === "cloud"
                ? "只有在导入卡片中主动选择的内容，才会保存到私有云端。"
                : "回到极简模式，开启“成长记录”后生成第一本成长绘本。"}
            </p>
            {source === "local" ? (
              <Link href="/?mode=minimal">
                <Plus /> 记录第一个成长时刻
              </Link>
            ) : null}
          </section>
        ) : (
          <section className={styles.childGrid} aria-label={`${source === "cloud" ? "私有云端" : "当前设备"}孩子成长书架`}>
            {children.map((child) => (
              <Link
                className={styles.childCard}
                href={buildGrowthChildHref("/me/growth", child.childKey, source)}
                key={child.childKey}
              >
                <div className={styles.childVisual}>
                  {child.coverUrl ? <img src={child.coverUrl} alt="" /> : null}
                  <div className={styles.childAvatar}>
                    {child.avatarUrl ? (
                      <img src={child.avatarUrl} alt="" />
                    ) : (
                      <span>{child.childName.slice(0, 1)}</span>
                    )}
                  </div>
                </div>
                <div className={styles.childCardBody}>
                  <p>{child.recordCount} 个成长时刻</p>
                  <h2>{child.childName}的成长故事</h2>
                  <span>最近记录于 {formatDate(child.latestOccurredOn)}</span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
