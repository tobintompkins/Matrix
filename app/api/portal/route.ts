import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: "51B",
    endpoints: [
      "/api/portal/me",
      "/api/portal/dashboard",
      "/api/portal/service-requests",
      "/api/portal/equipment",
      "/api/portal/meters",
      "/api/portal/parts-requests",
      "/api/portal/documents",
      "/api/portal/pm",
      "/api/portal/contacts",
      "/api/portal/profile",
      "/api/portal/users",
      "/api/portal/notifications",
    ],
  });
}
