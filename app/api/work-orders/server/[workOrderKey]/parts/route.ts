import { requireMatrixPermission } from "@/lib/auth/server";
import { addServerWorkOrderPartForOffice } from "@/lib/work-orders/server-office-write";
import { officeActor, officeWriteJson } from "../../_office-response";

type RouteContext = { params: Promise<{ workOrderKey: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireMatrixPermission("MANAGE_WORK_ORDERS");
  if (!authResult.ok) return authResult.response;

  const { workOrderKey } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return officeWriteJson({ ok: false, error: "Invalid JSON", status: 400 });
  }

  return officeWriteJson(
    await addServerWorkOrderPartForOffice(
      decodeURIComponent(workOrderKey),
      body,
      officeActor(authResult.profile),
    ),
  );
}
