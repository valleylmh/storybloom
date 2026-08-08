"use client";

import dynamic from "next/dynamic";
import AuthGate from "@/components/auth/AuthGate";
import styles from "@/components/account/Account.module.css";

const FamilyLibrary = dynamic(
  () => import("@/components/family/FamilyLibrary"),
  {
    ssr: false,
    loading: () => <div className={styles.inlineLoading}>正在加载家庭角色</div>,
  },
);

export default function MyCharactersPage() {
  return (
    <AuthGate
      next="/me/characters"
      loginVariant="family"
      inline
      className={styles.authGate}
      loadingFallback={(
        <div className={styles.inlineLoading}>正在检查登录状态</div>
      )}
    >
      <FamilyLibrary embedded />
    </AuthGate>
  );
}
