import { redirect } from "next/navigation";

/** Legacy /tickets workspace — Patch 41 routes to the live service-call list. */
export default function TicketsPage() {
  redirect("/service-calls");
}
