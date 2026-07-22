import { listCategoryLogs } from "@/lib/system-logs/api-helpers";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return listCategoryLogs(req, "VIEW_USER_ACTIVITY_LOGS", {
    category: "USER_ACTIVITY",
  });
}
