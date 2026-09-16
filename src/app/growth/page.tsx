import { redirect } from "next/navigation";

// Keep previously shared/bookmarked URLs working.
export default function GrowthPage() {
  redirect("/me");
}
