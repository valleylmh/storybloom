"use client";

import type { ReactNode } from "react";
import AccountHeader from "./AccountHeader";
import AccountSidebar from "./AccountSidebar";
import styles from "./Account.module.css";

export default function AccountShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <AccountSidebar />
      <div className={styles.workspace}>
        <AccountHeader />
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
