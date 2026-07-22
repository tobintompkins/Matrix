import { listCategoryLogs } from "@/lib/system-logs/api-helpers";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return listCategoryLogs(req, "VIEW_API_LOGS", { category: "API" });
}
