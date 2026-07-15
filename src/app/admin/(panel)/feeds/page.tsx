import { redirect } from "next/navigation";
// Legacy path — the Developer-Feeds module was merged into Developments.
export default function LegacyFeedsRedirect() {
  redirect("/admin/developments");
}
