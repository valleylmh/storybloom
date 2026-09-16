import AccountSettingsPanel from "@/components/account/AccountSettingsPanel";

import AccountSyncDetails from "@/components/account/AccountSyncDetails";

export const metadata = {
  title: "数据与隐私 | StoryBloom",
};

export default function SettingsPage() {
  return <><AccountSyncDetails /><AccountSettingsPanel /></>;
}
