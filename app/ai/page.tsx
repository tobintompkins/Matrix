import { redirect } from "next/navigation";

/** Part 1 route — redirect to Part 2 AI Operations Center dashboard. */
export default function AiCenterRedirectPage() {
  redirect("/ai-operations");
}
