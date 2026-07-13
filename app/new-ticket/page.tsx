import { redirect } from "next/navigation";

/** Legacy route — Patch 32 create flow lives at /service-calls/new */
export default function NewTicketPage() {
  redirect("/service-calls/new");
}
