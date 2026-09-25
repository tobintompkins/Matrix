import type { OfficeQueueRolloutResolution } from "@/lib/work-orders/office-queue-rollout";

type Props = {
  rollout: OfficeQueueRolloutResolution;
  context: "list" | "detail";
};

export default function OfficeQueueRolloutBanner({ rollout, context }: Props) {
  if (rollout.indicator === "browser-default") return null;

  const tone =
    rollout.indicator === "server-active"
      ? "border-cyan-800/60 bg-cyan-950/40 text-cyan-100"
      : "border-amber-800/60 bg-amber-950/40 text-amber-100";

  const detailNote =
    context === "detail" && rollout.indicator === "server-active"
      ? " Browser edits are disabled while the server queue is active for this manager."
      : context === "detail" && rollout.indicator === "browser-rollback"
        ? " This detail view reads from the browser queue."
        : "";

  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">{rollout.title}</p>
      <p className="mt-1 text-xs opacity-90">
        {rollout.description}
        {detailNote}
      </p>
      {rollout.blockedReasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-90">
          {rollout.blockedReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
